import { on } from '../bus'
import { materialsRepo } from '@/modules/dept/warehouse/warehouse.repo'
import {
  catalogFillPatch,
  lastPriceUpdates,
  linesByMaterial,
} from '@/lib/po-catalog-backfill'

/**
 * DANH MỤC TỰ GIÀU TỪ ĐƠN ĐẶT (13/08/2026) — side-effect nên đi event bus,
 * không gọi chéo service (nếp CLAUDE.md); lỗi ở đây được bus nuốt + log,
 * không làm hỏng việc lưu đơn.
 *
 *   · `po.lines_saved`  → điền Ô TRỐNG mô tả (quy cách/vật liệu/bề mặt/cách
 *     mở/pcs-thùng) — fill-empty-only, không bao giờ đè.
 *   · `po.ordered`      → `last_purchase_price` = giá dòng lúc GỬI NCC (đè có
 *     chủ đích — "giá gần nhất"; chỉ đơn VND).
 *
 * Barem kg/m · dài cây · kg/đơn-vị CỐ Ý không có ở đây — giữ nút bấm tay
 * "lưu vào danh mục" trên form, số nhân ra tiền phải qua tay người.
 */
export function registerPoCatalogHandlers(): void {
  on('po.lines_saved', async (e) => {
    for (const [materialId, line] of linesByMaterial(e.lines)) {
      const m = await materialsRepo.findById(materialId)
      if (!m) continue
      const patch = catalogFillPatch(m, line)
      if (patch) await materialsRepo.patch(materialId, patch)
    }
  })

  on('po.ordered', async (e) => {
    for (const [materialId, price] of lastPriceUpdates(e.currency, e.lines)) {
      await materialsRepo.patch(materialId, { last_purchase_price: price })
    }
  })
}
