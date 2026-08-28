import { on } from '../bus'
import { materialChangesRepo } from '@/modules/dept/warehouse/warehouse.repo'

/**
 * VẾT THAY ĐỔI DANH MỤC VẬT TƯ (0177) — MỘT nguồn ghi duy nhất.
 *
 * Service chỉ `emit`, handler ghi bảng; lỗi ghi vết được bus nuốt + log, KHÔNG
 * làm hỏng thao tác gốc (sửa vật tư vẫn thành công dù sổ vết trục trặc). Cùng
 * nếp với rbac.audit / approval.audit.
 */
export function registerMaterialAuditHandlers(): void {
  on('material.changed', async (e) => {
    if (e.changes.length === 0) return
    await materialChangesRepo.insertMany(
      e.changes.map((c) => ({
        material_id: e.material_id,
        material_code: e.material_code,
        field: c.field,
        before_value: c.before,
        after_value: c.after,
        actor_id: e.actor_id,
        source: e.source,
        source_ref: e.source_ref,
      })),
    )
  })
}
