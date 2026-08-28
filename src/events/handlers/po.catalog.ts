import { on } from '../bus'
import { emit } from '../bus'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { lastPriceUpdates } from '@/lib/po-catalog-backfill'
import { normValue } from '@/lib/material-diff'

/**
 * GIÁ MUA GẦN NHẤT theo đơn đặt (13/08/2026) — side-effect nên đi event bus,
 * không gọi chéo service (nếp CLAUDE.md); lỗi ở đây được bus nuốt + log,
 * không làm hỏng việc chuyển trạng thái đơn.
 *
 * `po.ordered` (approved → gửi NCC) → `last_purchase_price` = giá dòng lúc gửi
 * (đè có chủ đích — cột này nghĩa là "giá gần nhất"; chỉ đơn VND, xem
 * po-catalog-backfill).
 *
 * 28/08/2026 — GHI VẾT (0177): đây là đường DUY NHẤT trong app ghi đè một con
 * số đi thẳng vào giá thành, mà trước đó giá cũ biến mất không dấu vết. Nay đọc
 * bản trước để lấy giá cũ rồi phát `material.changed` (nguồn `po_price`, kèm mã
 * đơn). Đọc thêm một lượt/vật tư là giá phải trả để có sổ; đổi giá không phải
 * việc chạy hàng nghìn lần một phút.
 *
 * Phần MÔ TẢ (quy cách/vật liệu/cách mở…) KHÔNG tự ghi — user chốt 13/08/2026:
 * đi qua hộp xác nhận sau khi lưu đơn (posService.catalogSuggestions
 * → /api/dept/warehouse/materials/enrich).
 */
export function registerPoCatalogHandlers(): void {
  on('po.ordered', async (e) => {
    for (const [materialId, price] of lastPriceUpdates(e.currency, e.lines)) {
      const before = await materialsRepo.findById(materialId)
      if (!before) continue
      const beforePrice = normValue(before.last_purchase_price)
      const afterPrice = normValue(price)
      if (beforePrice === afterPrice) continue // giá y như cũ — không ghi, không đẻ vết
      await materialsRepo.patch(materialId, { last_purchase_price: price })
      await emit({
        name: 'material.changed',
        material_id: materialId,
        material_code: before.code,
        actor_id: e.ordered_by,
        source: 'po_price',
        source_ref: e.code,
        changes: [
          { field: 'last_purchase_price', before: beforePrice, after: afterPrice },
        ],
      })
    }
  })
}
