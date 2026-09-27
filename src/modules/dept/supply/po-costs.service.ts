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
import { PoCostDbError, poCostsRepo, type PoCost, type PoForCost } from './po-costs.repo'
import type { PoCostCreateInput } from './po-costs.schema'

/**
 * PHIẾU CHI PHÍ MUA HÀNG (0211) — phí vận chuyển / bốc xếp / phí khác.
 *
 * Chốt 26/09/2026: người thu là NCC của đơn hoặc nhà xe; một phiếu gắn nhiều
 * đơn, tiền chia theo tiền hàng; CHƯA vào giá vốn nhập kho; ghi số thực tế.
 * Không sửa, không xoá — sai thì huỷ kèm lý do rồi lập lại.
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

export const poCostsService = {
  async listByPo(_user: User, poId: string): Promise<PoCost[]> {
    return poCostsRepo.listByPo(poId)
  },

  /**
   * Hộp ghi phí: đơn đang mở + GỢI Ý đơn cùng chuyến (cùng nơi giao, nhập kho
   * trong ±3 ngày — không tick sẵn, người dùng chọn) + kết quả ô tìm theo mã
   * đơn / tên NCC. Chỉ đơn nhận phí được mới vào hai danh sách sau.
   */
  async candidates(
    _user: User,
    poId: string,
    q?: string,
  ): Promise<{ po: CostCandidate; suggested: CostCandidate[]; found: CostCandidate[] }> {
    const [po] = await poCostsRepo.posForCost([poId])
    if (!po) throw NotFound('Đơn đặt không tồn tại')
    const pool = (await poCostsRepo.eligiblePos(PO_COST_STATUSES)).filter(
      (x) => x.id !== po.id,
    )
    const recv = await poCostsRepo.lastReceivedOn([po.id, ...pool.map((x) => x.id)])
    const toCand = (x: PoForCost): CostCandidate => ({
      id: x.id,
      code: x.code,
      supplier_id: x.supplier_id,
      supplier_name: x.supplier_name,
      currency: x.currency,
      base: goodsBase(x),
      received_on: recv.get(x.id) ?? null,
      place: x.place,
    })
    const mineOn = recv.get(po.id)
    const suggested = pool.filter((x) => {
      if (!samePlace(po.place, x.place)) return false
      const on = recv.get(x.id)
      return !mineOn || !on || dayDiff(mineOn, on) <= TRIP_DAYS
    })
    const needle = q?.trim() ? nod(q.trim()) : ''
    const found = needle
      ? pool
          .filter((x) => nod(`${x.code} ${x.supplier_name ?? ''}`).includes(needle))
          .slice(0, 20)
      : []
    return { po: toCand(po), suggested: suggested.map(toCand), found: found.map(toCand) }
  },

  /** Nhà xe trong danh mục — ô chọn "Nhà xe / đơn vị khác". */
  async carriers(_user: User) {
    return poCostsRepo.carriers()
  },

  /**
   * Thêm nhà xe NGAY trong hộp ghi phí (Q1, chốt 26/09/2026) — chỉ tên + SĐT.
   * Vào danh mục NCC với loại "Vận chuyển" và KHÔNG đặt hàng được, nên không
   * lẫn vào ô chọn NCC khi soạn đơn. Gác bằng quyền ghi phí chứ không phải
   * quyền sửa danh mục NCC: Kế toán cầm hoá đơn nhà xe cũng phải thêm được.
   */
  async addCarrier(user: User, input: { name: string; phone?: string | null }) {
    await assertAction(user, 'supply.po_cost.manage')
    const name = input.name.trim()
    const existing = (await poCostsRepo.carriers()).find((c) => nod(c.name) === nod(name))
    if (existing) return existing
    const code = nextSupplierCode(name, await poCostsRepo.supplierCodes()) || null
    return poCostsRepo.insertCarrier({
      name,
      phone: input.phone?.trim() || null,
      code,
      userId: user.id,
    })
  },

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
          payee_supplier_id: input.payee_supplier_id,
          kind: input.kind,
          cost_date: input.cost_date,
          doc_no: input.doc_no ?? null,
          currency,
          amount: money.amount,
          vat_rate: input.vat_rate ?? null,
          vat_amount: money.vat_amount,
          total: money.total,
          note: input.note ?? null,
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
    const ok = await poCostsRepo.void(id, user.id, reason.trim())
    if (!ok) {
      const cost = await poCostsRepo.findById(id)
      if (!cost) throw NotFound('Phiếu chi phí không tồn tại')
      throw BadRequest('Phiếu đã huỷ rồi')
    }
    return (await poCostsRepo.findById(id))!
  },
}
