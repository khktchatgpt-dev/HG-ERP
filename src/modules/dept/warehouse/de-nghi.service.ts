import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { pricesRepo } from '@/modules/dept/supply/prices.repo'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import { dongTrong, vuongGuiDuyet } from '@/lib/de-nghi'
import { deNghiRepo, type DeNghiDay, type DeNghiDong, type DongGhi } from './de-nghi.repo'
import type { DeNghiSaveInput } from './de-nghi.schema'
import { canViewWarehouse } from './warehouse.service'

/**
 * ĐỀ NGHỊ MUA VẬT TƯ (0236) — Đ1: Kho lập, sửa nháp, gửi duyệt, rút về, huỷ.
 * Duyệt (Đ2) và lập đơn mua từ phiếu (Đ3) đến sau. Bản vẽ
 * https://claude.ai/artifact/6bFb19HuFtSzT8y2wqT17g (duyệt 13/10/2026).
 */

/** Giá mua gần nhất của một mã — từ DÒNG ĐƠN thật (`pricesRepo.lastPurchases`). */
export type GiaGanNhat = {
  unit_price: number
  po_code: string
  supplier_name: string
  at: string
}

export type DongChiTiet = DeNghiDong & {
  /** Mã danh mục, null = dòng gõ tên tự do. */
  code: string | null
  /** Tồn dùng được hiện tại, null = dòng chưa có mã. */
  ton: number | null
  gia_gan_nhat: GiaGanNhat | null
}

export type DeNghiChiTiet = Omit<DeNghiDay, 'lines'> & { lines: DongChiTiet[] }

/** Gợi ý khi thêm dòng có mã: tồn + giá mua gần nhất (VND). */
async function goiYTheoMa(ids: string[]): Promise<{
  ton: Map<string, number>
  gia: Map<string, GiaGanNhat>
}> {
  if (ids.length === 0) return { ton: new Map(), gia: new Map() }
  const [ton, mua] = await Promise.all([
    deNghiRepo.tonDungDuoc(ids),
    pricesRepo.lastPurchases(ids),
  ])
  const gia = new Map<string, GiaGanNhat>()
  // Phiếu đề nghị tính bằng VND; giá đơn USD không gợi ý (đổi tỷ giá là đoán).
  for (const p of mua)
    if (p.currency === 'VND')
      gia.set(p.material_id, {
        unit_price: p.unit_price,
        po_code: p.po_code,
        supplier_name: p.supplier_name,
        at: p.at,
      })
  return { ton, gia }
}

async function canManage(user: User) {
  return canAction(user, 'warehouse.request.manage')
}

async function xemDuoc(user: User) {
  if (!(await canViewWarehouse(user))) throw Forbidden('Chỉ phòng Kho truy cập được')
}

/** Chuẩn hoá dòng gửi lên: bỏ dòng trống, dòng có mã lấy tên / ĐVT từ danh mục. */
async function chuanDong(input: DeNghiSaveInput['lines']): Promise<DongGhi[]> {
  const dong = input.filter(
    (l) => !dongTrong({ material_id: l.material_id ?? null, name: l.name, qty: l.qty }),
  )
  const ids = [...new Set(dong.map((l) => l.material_id).filter((x): x is string => !!x))]
  const vt = await deNghiRepo.vatTu(ids)
  return dong.map((l) => {
    const m = l.material_id ? vt.get(l.material_id) : undefined
    if (l.material_id && !m) throw BadRequest(`Mã vật tư của dòng "${l.name}" không còn trong danh mục`) // prettier-ignore
    return {
      material_id: l.material_id ?? null,
      name: m ? m.name : l.name,
      unit: m ? m.unit : l.unit,
      qty: l.qty,
      unit_price: l.unit_price ?? null,
      purpose: l.purpose ?? null,
      note: l.note ?? null,
    }
  })
}

async function phieu(id: string): Promise<DeNghiDay> {
  const p = await deNghiRepo.findById(id)
  if (!p) throw NotFound('Không thấy phiếu đề nghị')
  return p
}

export const deNghiService = {
  async list(user: User): Promise<DeNghiDay[]> {
    await xemDuoc(user)
    return deNghiRepo.list()
  },

  async get(
    user: User,
    id: string,
  ): Promise<{ phieu: DeNghiChiTiet; canManage: boolean }> {
    await xemDuoc(user)
    const p = await phieu(id)
    const ids = [
      ...new Set(p.lines.map((l) => l.material_id).filter((x): x is string => !!x)),
    ]
    const [vt, { ton, gia }, sua] = await Promise.all([
      deNghiRepo.vatTu(ids),
      goiYTheoMa(ids),
      canManage(user),
    ])
    return {
      phieu: {
        ...p,
        lines: p.lines.map((l) => ({
          ...l,
          code: l.material_id ? (vt.get(l.material_id)?.code ?? null) : null,
          ton: l.material_id ? (ton.get(l.material_id) ?? 0) : null,
          gia_gan_nhat: l.material_id ? (gia.get(l.material_id) ?? null) : null,
        })),
      },
      canManage: sua,
    }
  },

  /** Gợi ý tồn + giá gần nhất cho các mã vừa thêm trên màn lập phiếu. */
  async goiY(
    user: User,
    ids: string[],
  ): Promise<Record<string, { ton: number; gia: GiaGanNhat | null }>> {
    await xemDuoc(user)
    const { ton, gia } = await goiYTheoMa([...new Set(ids)].slice(0, 200))
    const out: Record<string, { ton: number; gia: GiaGanNhat | null }> = {}
    for (const id of new Set(ids))
      out[id] = { ton: ton.get(id) ?? 0, gia: gia.get(id) ?? null }
    return out
  },

  async create(
    user: User,
    input: DeNghiSaveInput,
  ): Promise<{ id: string; code: string }> {
    await assertAction(user, 'warehouse.request.manage')
    const lines = await chuanDong(input.lines)
    const code = await deNghiRepo.nextCode()
    const { id } = await deNghiRepo.insert({
      code,
      department: input.department,
      need_by: input.need_by ?? null,
      note: input.note ?? null,
      production_order_id: input.production_order_id ?? null,
      requested_by: user.id,
      created_by: user.id,
    })
    await deNghiRepo.replaceLines(id, lines)
    return { id, code }
  },

  /** Lưu nháp: đầu phiếu + cả bộ dòng. Chỉ khi phiếu còn NHÁP. */
  async save(user: User, id: string, input: DeNghiSaveInput): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'draft')
      throw Conflict(`Phiếu ${p.code} đang "${p.status === 'pending' ? 'chờ duyệt' : p.status}" — rút về nháp rồi mới sửa`) // prettier-ignore
    const lines = await chuanDong(input.lines)
    const ok = await deNghiRepo.update(
      id,
      {
        department: input.department,
        need_by: input.need_by ?? null,
        note: input.note ?? null,
        production_order_id: input.production_order_id ?? null,
      },
      ['draft'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa đổi trạng thái — tải lại trang`)
    await deNghiRepo.replaceLines(id, lines)
  },

  /** Gửi lãnh đạo duyệt: draft → pending. Luật vướng giống hệt nút trên màn. */
  async submit(user: User, id: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'draft') throw Conflict(`Phiếu ${p.code} không còn là nháp`)
    const vuong = vuongGuiDuyet(p.lines)
    if (vuong.length > 0) throw BadRequest(vuong.map((v) => v.cau).join(' · '))
    const ok = await deNghiRepo.update(
      id,
      {
        status: 'pending',
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
      },
      ['draft'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa đổi trạng thái — tải lại trang`)
  },

  /** Rút về nháp khi lãnh đạo CHƯA duyệt (pending → draft). */
  async withdraw(user: User, id: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'pending')
      throw Conflict(`Chỉ rút được phiếu đang chờ duyệt — ${p.code} không còn chờ duyệt`)
    const ok = await deNghiRepo.update(id, { status: 'draft' }, ['pending'])
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
  },

  /** Huỷ (không xoá): nháp hoặc chờ duyệt, bắt lý do. */
  async cancel(user: User, id: string, reason: string): Promise<void> {
    await assertAction(user, 'warehouse.request.manage')
    const p = await phieu(id)
    if (p.status !== 'draft' && p.status !== 'pending')
      throw Conflict(`Phiếu ${p.code} đã duyệt — không huỷ ở Kho được`)
    const ok = await deNghiRepo.update(
      id,
      {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancel_reason: reason,
      },
      ['draft', 'pending'],
    )
    if (!ok) throw Conflict(`Phiếu ${p.code} vừa được xử lý — tải lại trang`)
  },
}
