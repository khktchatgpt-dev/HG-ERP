import { outsourceRepo, type OutsourceEntryJoined } from './outsource.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { summarizeOutsource, type OutsourceSummary } from '@/lib/production-summary'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * GIA CÔNG NGOÀI (thống kê ghi sổ giao/nhận per chi tiết × NCC — 0084).
 * Đối chiếu thiếu/dư per (chi tiết, NCC) tính ở lib production-summary.
 */

export type OutsourcePairSummary = {
  component_id: string
  component_name: string | null
  supplier_id: string
  supplier_name: string | null
  summary: OutsourceSummary
}

export const outsourceService = {
  /** Sổ + đối chiếu per (chi tiết, NCC). Đọc: mọi NV đã đăng nhập. */
  async list(
    _user: User,
    lsxId: string,
  ): Promise<{ entries: OutsourceEntryJoined[]; pairs: OutsourcePairSummary[] }> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const entries = await outsourceRepo.listByLsx(lsxId)
    const byPair = new Map<string, OutsourceEntryJoined[]>()
    for (const e of entries) {
      const k = `${e.component_id}|${e.supplier_id}`
      const arr = byPair.get(k) ?? []
      arr.push(e)
      byPair.set(k, arr)
    }
    const pairs: OutsourcePairSummary[] = [...byPair.entries()].map(([, list]) => ({
      component_id: list[0].component_id,
      component_name: list[0].component_name,
      supplier_id: list[0].supplier_id,
      supplier_name: list[0].supplier_name,
      summary: summarizeOutsource(list),
    }))
    return { entries, pairs }
  },

  /** Ghi 1 dòng giao/nhận gia công. */
  async record(
    user: User,
    lsxId: string,
    input: {
      component_id: string
      supplier_id: string
      direction: 'send' | 'receive'
      entry_date: string
      qty: number
      kg?: number | null
      defect_qty?: number
      note?: string | null
    },
  ): Promise<void> {
    await assertAction(user, 'production.outsource.record')
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('Chỉ ghi gia công cho LSX đã duyệt / đang sản xuất')
    }
    const components = await componentsRepo.listByLsx(lsxId)
    if (!components.some((c) => c.id === input.component_id)) {
      throw BadRequest('Chi tiết không thuộc lệnh này')
    }
    await outsourceRepo.insert({
      production_order_id: lsxId,
      component_id: input.component_id,
      supplier_id: input.supplier_id,
      direction: input.direction,
      entry_date: input.entry_date,
      qty: input.qty,
      kg: input.kg ?? null,
      defect_qty: input.defect_qty ?? 0,
      note: input.note ?? null,
      created_by: user.id,
    })
  },

  /** Xoá dòng ghi nhầm: người tạo hoặc GĐ/QL. */
  async deleteEntry(user: User, entryId: string): Promise<void> {
    const entry = await outsourceRepo.findById(entryId)
    if (!entry) throw NotFound('Bản ghi gia công không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || entry.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người nhập hoặc Ban quản lý xoá được bản ghi')
    const lsx = await productionRepo.findById(entry.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ gia công khoá')
    }
    await outsourceRepo.delete(entryId)
  },
}
