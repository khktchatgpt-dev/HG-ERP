import { on } from '../bus'
import { docNotesRepo } from '@/modules/core/doc-notes/doc-notes.repo'

const so = (n: number) => n.toLocaleString('vi-VN')

/**
 * VẾT GHI KG CÂN BỔ SUNG (01/10/2026) — ghi vào Trao đổi (NỘI BỘ) của đơn mua.
 *
 * Vì sao Trao đổi chứ không một bảng vết riêng: người cần biết là người mua và
 * Kế toán, và họ đọc chuyện của đơn ở đó. Một câu có tên người ghi, giờ ghi,
 * từng dòng trước → sau, và lý do — đủ để hậu kiểm, không thêm bảng.
 *
 * Service chỉ `emit`; lỗi ghi vết bus nuốt + log, không làm hỏng việc ghi kg
 * (cùng nếp material.audit / rbac.audit).
 */
export function registerWarehouseAuditHandlers(): void {
  on('warehouse.kg.recorded', async (e) => {
    const dong = e.lines
      .map(
        (l) =>
          `${l.code} ${so(l.qty)} ${l.unit}: ${l.before == null ? 'chưa cân' : `${so(l.before)} kg`} → ${so(l.after)} kg`,
      )
      .join('; ')
    await docNotesRepo.create(
      {
        doc_type: 'po',
        doc_id: e.po_id,
        author_id: e.actor_id,
        audience: 'internal',
        body: `Ghi kg cân bổ sung cho ${e.doc_code} — ${dong}. Lý do: ${e.reason}`,
      },
      e.actor_name,
    )
  })
}
