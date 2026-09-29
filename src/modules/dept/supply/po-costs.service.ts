import {
  allocateCost,
  canCarryCost,
  costMoney,
  PO_COST_STATUSES,
  samePlace,
} from '@/lib/po-cost'
import { poLineAmount, poMoney } from '@/lib/po-line'
import { nod } from '@/lib/material-key'
import { nextSupplierCode } from '@/lib/supplier-code'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'
import {
  PoCostDbError,
  poCostsRepo,
  type Carrier,
  type PoCost,
  type PoForCost,
} from './po-costs.repo'
import type {
  CarrierCreateInput,
  CarrierPatchInput,
  PoCostCreateInput,
} from './po-costs.schema'

/**
 * PHIẾU CHI PHÍ VẬN CHUYỂN (0211 + 0215) — một chuyến = một phiếu.
 *
 * Chốt 26/09/2026: người thu là NCC của đơn hoặc nhà xe; một phiếu gắn nhiều
 * đơn, tiền chia theo tiền hàng; CHƯA vào giá vốn nhập kho; ghi số thực tế.
 * Không sửa, không xoá — sai thì huỷ kèm lý do rồi lập lại.
 *
 * Chốt 28/09/2026: đơn vị vận chuyển TÁCH khỏi NCC (danh mục riêng); có ship
 * lẻ gõ tự do; Kế toán trả là chính nhưng Cung ứng đôi khi chi trước (chi hộ
 * → Kế toán hoàn, không vào sổ 331); trả theo chuyến.
 *
 * Quyền: `supply.po_cost.manage` (Cung ứng + Kế toán, như hoá đơn NCC). Không
 * gác theo người phụ trách đơn: hoá đơn nhà xe thường tới tay Kế toán, và một
 * chuyến xe chở hàng của đơn nhiều người phụ trách.
 */

/** Một đơn trong hộp ghi phí — đơn đang mở, gợi ý cùng chuyến, hoặc kết quả tìm. */
export type CostCandidate = {
  id: string
  code: string
  supplier_id: string
  supplier_name: string | null
  currency: string
  /** Tiền hàng sau chiết khấu, CHƯA VAT — gốc chia phí. */
  base: number
  /** Ngày nhập kho gần nhất (YYYY-MM-DD), null = chưa nhập. */
  received_on: string | null
  place: string | null
}

/** Cửa sổ ngày quanh lần nhập kho của đơn đang mở để coi là "cùng chuyến" (Q2). */
const TRIP_DAYS = 3

/** Tiền hàng sau chiết khấu, chưa VAT — đơn giá gồm VAT thì tách ra. */
function goodsBase(p: PoForCost): number {
  const m = poMoney({
    subtotalRaw: p.lines.reduce((s, l) => s + poLineAmount(l), 0),
    discount: p.discount_amount,
    vatRate: p.vat_rate,
    priceIncludesVat: p.price_includes_vat,
    currency: p.currency,
  })
  return m.grandTotal - m.vatAmount
}

const dayDiff = (a: string, b: string) =>
  Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000

const toCand = (x: PoForCost, recv: Map<string, string>): CostCandidate => ({
  id: x.id,
  code: x.code,
  supplier_id: x.supplier_id,
  supplier_name: x.supplier_name,
  currency: x.currency,
  base: goodsBase(x),
  received_on: recv.get(x.id) ?? null,
  place: x.place,
})

export const poCostsService = {
  async listByPo(_user: User, poId: string): Promise<PoCost[]> {
    return poCostsRepo.listByPo(poId)
  },

  /** Sổ chuyến — mọi phiếu, kể cả đã huỷ. Ai mở được Mua hàng cũng xem được. */
  async listAll(_user: User): Promise<PoCost[]> {
    return poCostsRepo.listAll()
  },

  /**
   * Hộp ghi phí. Có `poId`: đơn đang mở + GỢI Ý đơn cùng chuyến (cùng nơi giao,
   * nhập kho trong ±3 ngày — không tick sẵn, người dùng chọn). Không `poId`
   * (ghi từ sổ chuyến): chỉ có ô tìm. `q` tìm theo mã đơn / tên NCC.
   */
  async candidates(
    _user: User,
    poId: string | undefined,
    q?: string,
  ): Promise<{
    po: CostCandidate | null
    suggested: CostCandidate[]
    found: CostCandidate[]
  }> {
    const po = poId ? (await poCostsRepo.posForCost([poId]))[0] : null
    if (poId && !po) throw NotFound('Đơn đặt không tồn tại')
    const pool = (await poCostsRepo.eligiblePos(PO_COST_STATUSES)).filter(
      (x) => x.id !== po?.id,
    )
    const recv = await poCostsRepo.lastReceivedOn([
      ...(po ? [po.id] : []),
      ...pool.map((x) => x.id),
    ])
    const mineOn = po ? recv.get(po.id) : undefined
    const suggested = po
      ? pool.filter((x) => {
          if (!samePlace(po.place, x.place)) return false
          const on = recv.get(x.id)
          return !mineOn || !on || dayDiff(mineOn, on) <= TRIP_DAYS
        })
      : []
    const needle = q?.trim() ? nod(q.trim()) : ''
    const found = needle
      ? pool
          .filter((x) => nod(`${x.code} ${x.supplier_name ?? ''}`).includes(needle))
          .slice(0, 20)
      : []
    return {
      po: po ? toCand(po, recv) : null,
      suggested: suggested.map((x) => toCand(x, recv)),
      found: found.map((x) => toCand(x, recv)),
    }
  },

  /* ── Đơn vị vận chuyển ─────────────────────────────────────────────── */

  /** Ô chọn trên phiếu: đơn vị đang dùng. `all`: cả đã ngừng — cho danh mục. */
  async carriers(_user: User, opts: { all?: boolean } = {}): Promise<Carrier[]> {
    return poCostsRepo.carriers(opts)
  },

  /** Hồ sơ đơn vị + phiếu của đơn vị đó (mới trước, kể cả huỷ). */
  async carrierDetail(
    _user: User,
    id: string,
  ): Promise<{ carrier: Carrier; costs: PoCost[] }> {
    const carrier = await poCostsRepo.carrierById(id)
    if (!carrier) throw NotFound('Đơn vị vận chuyển không tồn tại')
    return { carrier, costs: await poCostsRepo.listByPayee(id) }
  },

  /**
   * Thêm đơn vị vận chuyển — từ hộp ghi phí hay từ danh mục. Trùng tên (không
   * phân biệt dấu) → trả đơn vị có sẵn, không thêm. Gác bằng quyền ghi phí chứ
   * không phải quyền sửa danh mục NCC: Kế toán cầm phiếu nhà xe cũng thêm được.
   */
  async addCarrier(user: User, input: CarrierCreateInput): Promise<Carrier> {
    await assertAction(user, 'supply.po_cost.manage')
    const name = input.name.trim()
    const existing = (await poCostsRepo.carriers({ all: true })).find(
      (c) => nod(c.name) === nod(name),
    )
    if (existing) return existing
    const code = nextSupplierCode(name, await poCostsRepo.supplierCodes()) || null
    return poCostsRepo.insertCarrier({
      name,
      phone: input.phone?.trim() || null,
      contact_name: input.contact_name?.trim() || null,
      carrier_kind: input.carrier_kind ?? 'nha_xe',
      address: input.address?.trim() || null,
      pay_method: input.pay_method ?? null,
      payment_terms: input.payment_terms?.trim() || null,
      note: input.note?.trim() || null,
      code,
      userId: user.id,
    })
  },

  async patchCarrier(user: User, id: string, input: CarrierPatchInput): Promise<Carrier> {
    await assertAction(user, 'supply.po_cost.manage')
    const s = (x: string | null | undefined) => (x == null ? x : x.trim() || null)
    const patch: Record<string, unknown> = {}
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.phone !== undefined) patch.phone = s(input.phone)
    if (input.contact_name !== undefined) patch.contact_name = s(input.contact_name)
    if (input.carrier_kind !== undefined) patch.carrier_kind = input.carrier_kind
    if (input.address !== undefined) patch.address = s(input.address)
    if (input.pay_method !== undefined) patch.pay_method = input.pay_method
    if (input.payment_terms !== undefined) patch.payment_terms = s(input.payment_terms)
    if (input.note !== undefined) patch.note = s(input.note)
    if (input.is_active !== undefined) {
      patch.is_active = input.is_active
      patch.status = input.is_active ? 'active' : 'terminated'
    }
    const out = await poCostsRepo.patchCarrier(id, patch, user.id)
    if (!out) throw NotFound('Đơn vị vận chuyển không tồn tại')
    return out
  },

  /* ── Phiếu ─────────────────────────────────────────────────────────── */

  async create(user: User, input: PoCostCreateInput): Promise<PoCost> {
    await assertAction(user, 'supply.po_cost.manage')

    const found = await poCostsRepo.posForCost(input.po_ids)
    if (found.length !== new Set(input.po_ids).size) {
      throw NotFound('Có đơn không tồn tại — tải lại trang')
    }

    const blocked = found
      .map((p) => ({ p, g: canCarryCost(p.status) }))
      .filter((x) => !x.g.ok)
      .map((x) => `${x.p.code}: ${x.g.ok ? '' : x.g.reason}`)
    if (blocked.length) throw BadRequest(blocked.join(' · '))

    // Một phiếu một tiền tệ — chia theo tiền hàng mà các đơn khác tiền tệ thì
    // tỷ lệ vô nghĩa. Tiền tệ của phiếu = tiền tệ của các đơn.
    const currency = found[0].currency
    if (found.some((p) => p.currency !== currency)) {
      throw BadRequest(
        `Các đơn khác tiền tệ (${[...new Set(found.map((p) => p.currency))].join(', ')}) — tách thành từng phiếu theo tiền tệ`,
      )
    }

    /*
      NGƯỜI THU theo hình thức (0215):
        nha_xe  → đơn vị trong danh mục (bắt buộc).
        ship_le → gõ tay tên (+SĐT); "lưu vào danh mục" thì thành đơn vị luôn.
        ncc     → chính NCC của một đơn trong phiếu — phí lên hoá đơn NCC.
      CHƯA TRẢ thì người thu phải có trong danh mục — không thì Kế toán không
      biết trả cho ai (ràng buộc DB kiểm lại lần nữa).
    */
    let payeeId = input.payee_supplier_id ?? null
    let payeeName = input.payee_name?.trim() || null
    const payeePhone = input.payee_phone?.trim() || null
    if (input.transport_mode === 'nha_xe' && !payeeId) {
      throw BadRequest('Chọn nhà xe / chành trong danh mục, hoặc thêm mới ngay trong hộp')
    }
    if (input.transport_mode === 'ncc') {
      if (!payeeId || !found.some((p) => p.supplier_id === payeeId)) {
        throw BadRequest('NCC tự giao thì người thu phải là NCC của một đơn trong phiếu')
      }
    }
    if (input.transport_mode === 'ship_le') {
      if (!payeeId && !payeeName) throw BadRequest('Ghi tên người / đơn vị ship')
      if (!payeeId && input.save_to_catalog && payeeName) {
        const c = await this.addCarrier(user, {
          name: payeeName,
          phone: payeePhone,
          carrier_kind: 'tai_xe_le',
        })
        payeeId = c.id
      }
    }
    if (payeeId) payeeName = null
    if (!input.paid && !payeeId) {
      throw BadRequest(
        'Chưa trả thì Kế toán phải biết trả cho ai — tick "Lưu vào danh mục" hoặc ghi "Đã trả tại chỗ"',
      )
    }

    // Giữ thứ tự người dùng chọn (đơn đang mở đứng đầu) cho bảng phân bổ.
    const byId = new Map(found.map((p) => [p.id, p]))
    const bases = input.po_ids.map((id) => ({
      po_id: id,
      base: goodsBase(byId.get(id)!),
    }))

    const money = costMoney(input.amount, input.vat_rate, currency)
    const allocations = allocateCost(money.amount, bases, currency)

    let id: string
    try {
      id = await poCostsRepo.create({
        actorId: user.id,
        cost: {
          transport_mode: input.transport_mode,
          payee_supplier_id: payeeId,
          payee_name: payeeName,
          payee_phone: payeeId ? null : payeePhone,
          kind: input.kind,
          cost_date: input.cost_date,
          doc_no: input.doc_no ?? null,
          currency,
          amount: money.amount,
          vat_rate: input.vat_rate ?? null,
          vat_amount: money.vat_amount,
          total: money.total,
          note: input.note ?? null,
          paid_by: input.paid?.by ?? null,
          paid_on: input.paid?.on ?? null,
          paid_method: input.paid?.method ?? null,
        },
        allocations,
      })
    } catch (e) {
      if (e instanceof PoCostDbError) throw BadRequest(e.message)
      throw e
    }
    const cost = await poCostsRepo.findById(id)
    if (!cost) throw new Error('Phiếu vừa ghi không đọc lại được')
    return cost
  },

  async void(user: User, id: string, reason: string): Promise<PoCost> {
    await assertAction(user, 'supply.po_cost.manage')
    const invoices = await poCostsRepo.invoicesCarrying(id)
    if (invoices.length > 0) {
      throw BadRequest(
        `Phí này đã nằm trên hoá đơn NCC ${invoices.join(', ')} — nhờ Kế toán huỷ hoặc sửa hoá đơn đó trước, rồi mới huỷ phiếu.`,
      )
    }
    const cur = await poCostsRepo.findById(id)
    if (!cur) throw NotFound('Phiếu chi phí không tồn tại')
    if (cur.reimbursed_at) {
      throw BadRequest(
        'Kế toán đã hoàn tiền chi hộ cho phiếu này — nhờ Kế toán đảo phiếu hoàn trước, rồi mới huỷ.',
      )
    }
    const ok = await poCostsRepo.void(id, user.id, reason.trim())
    if (!ok) throw BadRequest('Phiếu đã huỷ rồi')
    return (await poCostsRepo.findById(id))!
  },
}
