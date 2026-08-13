import { on } from '../bus'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import { lastPriceUpdates } from '@/lib/po-catalog-backfill'

/**
 * GIÁ MUA GẦN NHẤT theo đơn đặt (13/08/2026) — side-effect nên đi event bus,
 * không gọi chéo service (nếp CLAUDE.md); lỗi ở đây được bus nuốt + log,
 * không làm hỏng việc chuyển trạng thái đơn.
 *
 * `po.ordered` (approved → gửi NCC) → `last_purchase_price` = giá dòng lúc gửi
 * (đè có chủ đích — cột này nghĩa là "giá gần nhất"; chỉ đơn VND, xem
 * po-catalog-backfill).
 *
 * Phần MÔ TẢ (quy cách/vật liệu/cách mở…) KHÔNG tự ghi nữa — user chốt
 * 13/08/2026: đi qua hộp xác nhận sau khi lưu đơn (posService.catalogSuggestions
 * → /api/dept/warehouse/materials/enrich).
 */
export function registerPoCatalogHandlers(): void {
  on('po.ordered', async (e) => {
    for (const [materialId, price] of lastPriceUpdates(e.currency, e.lines)) {
      await materialsRepo.patch(materialId, { last_purchase_price: price })
    }
  })
}
