import { z } from 'zod'
import { outsourceRepo, type OutsourceEntry } from './outsource.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { summarizeOutsource, type OutsourceSummary } from '@/lib/production-summary'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

/**
 * Gia công ngoài (SX-P4 — FR-OS-01/02): sổ giao ↔ nhận per chi tiết × đơn vị
 * (TTP, Vinh… = supply_suppliers). Ai ghi: xưởng / KH-CƯ / GĐ-QL.
 */

export const outsourceRecordSchema = z.object({
  component_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  direction: z.enum(['send', 'receive']),
  entry_date: z.string().date(),
  qty: z.coerce.number().positive('SL phải > 0'),
  kg: z.coerce.number().min(0).optional().nullable(),
  defect_qty: z.coerce.number().min(0).default(0), // hàng hỏng khi nhận về
  note: z.string().trim().max(500).optional().nullable(),
})
export type OutsourceRecordInput = z.infer<typeof outsourceRecordSchema>

export type OutsourcePairSummary = OutsourceSummary & {
  component_id: string
  component_name: string
  supplier_id: string
  supplier_name: string
}

export const outsourceService = {
  /** Ghi 1 lần giao / nhận. Nhận về > tổng đã giao → cảnh báo (không chặn). */
  async record(
    user: User,
    lsxId: string,
    input: OutsourceRecordInput,
  ): Promise<{ warnings: string[] }> {
    await assertAction(user, 'production.outsource.record')
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('Chỉ ghi gia công cho LSX đã duyệt / đang sản xuất')
    }
    const components = await componentsRepo.listByLsx(lsxId)
    const comp = components.find((c) => c.id === input.component_id)
    if (!comp) throw BadRequest('Chi tiết không thuộc lệnh này')
    const supplier = await suppliersRepo.findById(input.supplier_id)
    if (!supplier) throw NotFound('Đơn vị gia công không tồn tại')
    if (!supplier.is_active) throw BadRequest('Đơn vị gia công đã ngừng giao dịch')

    const warnings: string[] = []
    if (input.direction === 'receive') {
      const entries = await outsourceRepo.listByLsx(lsxId)
      const pair = entries.filter(
        (e) =>
          e.component_id === input.component_id && e.supplier_id === input.supplier_id,
      )
      const s = summarizeOutsource(pair)
      if (input.qty + s.received > s.sent) {
        warnings.push(
          `${comp.name} @ ${supplier.name}: nhận ${s.received + input.qty} > đã giao ${s.sent}`,
        )
      }
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
    return { warnings }
  },

  /** Đối chiếu per (chi tiết × đơn vị) + sổ — đọc: mọi NV. */
  async summary(_user: User, lsxId: string) {
    const [entries, components] = await Promise.all([
      outsourceRepo.listByLsx(lsxId),
      componentsRepo.listByLsx(lsxId),
    ])
    const nameByComp = new Map(components.map((c) => [c.id, c.name]))
    const byPair = new Map<string, OutsourceEntry[]>()
    for (const e of entries) {
      const k = `${e.component_id}|${e.supplier_id}`
      byPair.set(k, [...(byPair.get(k) ?? []), e])
    }
    const pairs: OutsourcePairSummary[] = [...byPair.entries()].map(([k, list]) => {
      const [component_id, supplier_id] = k.split('|')
      return {
        ...summarizeOutsource(list),
        component_id,
        component_name: nameByComp.get(component_id) ?? '?',
        supplier_id,
        supplier_name: list[0]?.supplier_name ?? '?',
      }
    })
    return { pairs, entries }
  },

  /** Xoá bản ghi nhầm — người tạo hoặc GĐ/QL; lệnh kết thúc thì khoá. */
  async deleteEntry(user: User, entryId: string): Promise<void> {
    const entry = await outsourceRepo.findById(entryId)
    if (!entry) throw NotFound('Bản ghi không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || entry.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người nhập hoặc Ban quản lý xoá được')
    const lsx = await productionRepo.findById(entry.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ gia công khoá')
    }
    await outsourceRepo.delete(entryId)
  },
}
