import { db } from '@/server/db'
import type { DocType } from '@/lib/doc-notes'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'

/**
 * TRA CHỨNG TỪ MÀ GHI CHÚ / YÊU CẦU VIỆC BÁM VÀO.
 *
 * Tách khỏi route `/api/doc-notes` (29/10/2026) vì yêu cầu việc (0281) cần đúng
 * phép tra đó — hai bản chép tay là hai chỗ để lệch nhau khi mở loại chứng từ thứ ba.
 *
 * Mỗi loại mở thêm thì thêm MỘT nhánh ở đây. Loại chưa nối vẫn bị chặn (trả null)
 * chứ không mở sẵn cửa: `doc_id` đến từ người dùng, và ghi chú nội bộ hay chứa
 * chuyện không phải ai cũng được đọc.
 */

/** Ai được nhắc khi có ghi chú mới — người đã đụng vào chứng từ. */
export type DocWatchers = {
  created_by?: string | null
  assigned_to?: string | null
  approved_by?: string | null
}

export type DocRef = { code: string; watchers: DocWatchers }

export async function loadDocRef(dt: DocType, id: string): Promise<DocRef | null> {
  if (dt === 'po') {
    const po = await posRepo.findById(id)
    if (!po) return null
    return {
      code: po.code,
      watchers: {
        created_by: po.created_by,
        assigned_to: po.assigned_to,
        approved_by: po.approved_by,
      },
    }
  }
  if (dt === 'lsx') {
    const lsx = await productionRepo.findById(id)
    if (!lsx) return null
    // Lệnh SX không có `assigned_to`. Người PHÁT HÀNH lệnh (Bán hàng) đóng vai
    // đó: họ là người phải biết ngay khi xưởng nói gì về lệnh, vì họ đang cầm
    // lời hứa ngày giao với khách.
    return {
      code: lsx.code,
      watchers: {
        created_by: lsx.created_by,
        assigned_to: lsx.issued_by,
        approved_by: lsx.approved_by,
      },
    }
  }
  return null
}

/** Mã chứng từ theo lô id — nhãn cho danh sách yêu cầu việc. Một truy vấn mỗi loại. */
export async function docCodesByIds(
  dt: DocType,
  ids: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)]
  if (uniq.length === 0) return new Map()
  if (dt === 'lsx') return productionRepo.listCodesByIds(uniq)
  if (dt === 'po') {
    const { data, error } = await db()
      .from('supply_purchase_orders')
      .select('id, code')
      .in('id', uniq)
    if (error) throw error
    return new Map(
      ((data ?? []) as { id: string; code: string }[]).map((r) => [r.id, r.code]),
    )
  }
  return new Map()
}
