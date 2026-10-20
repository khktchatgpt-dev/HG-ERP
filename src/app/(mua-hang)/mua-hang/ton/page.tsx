import { authService } from '@/modules/core/auth/auth.service'
import {
  listSupplyStock,
  type SupplyStockFilter,
} from '@/modules/dept/supply/supply-stock.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { PAGE_SIZE } from './ton-const'
import { TonView } from './TonView'

export const metadata = { title: 'Mua hàng · Tồn & cân đối' }
export const dynamic = 'force-dynamic'

const FILTERS: SupplyStockFilter[] = ['incoming', 'in_stock', 'low', 'short', 'all']

/**
 * TỒN & CÂN ĐỐI — Khuôn C, dựng bằng kit (Đợt 3, 14/09/2026).
 *
 * Câu trang trả lời, đúng như cây menu khai: "Còn bao nhiêu, có phải mua
 * không?" — nên trục chính KHÔNG phải tồn kho mà là **vị thế**:
 * khả dụng + đã đặt. Người mua quyết bằng con số đó, không bằng số tồn.
 *
 * KHÔNG VIẾT SERVICE MỚI: `listSupplyStock` đã lọc, đếm và phân trang ở
 * SERVER sẵn (bản cũ `/planning/stock` từng dính trần 1.000 dòng và giấu mất
 * đúng những mã đang có tồn — lý do ghi trong service). Đây chỉ là tầng nhìn
 * thứ hai trên cùng một nguồn số.
 *
 * MẶC ĐỊNH LÀ "ĐANG VỀ", không phải "tất cả": danh mục 13.226 mã mà chỉ 116
 * mã có tồn > 0 (đo 14/09/2026) — mở ra thấy 13.226 dòng số 0 thì trang nói
 * đúng sự thật nhưng vô dụng. Việc đang chạy của người mua là số hàng đã đặt
 * chưa về.
 *
 * NGƯỠNG BÙ TỒN gần như chưa ai khai: `reorder_point` 0/13.226, `min_stock`
 * 5/13.226. Chip "Dưới ngưỡng" vẫn giữ và vẫn hiện số THẬT của nó — số 0 ở
 * đây là một câu trả lời ("chưa ai đặt ngưỡng"), không phải lỗi. Nhưng KHÔNG
 * có cột ngưỡng: một cột rỗng 99,96%.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nhom?: string; loc?: string; trang?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const group = sp.nhom?.trim() || undefined
  const page = Math.max(1, Number(sp.trang) || 1)
  const filter = (
    FILTERS.includes(sp.loc as SupplyStockFilter) ? sp.loc : 'incoming'
  ) as SupplyStockFilter

  const [{ rows, total, counts }, tax] = await Promise.all([
    listSupplyStock(user, { q, group_name: group, filter, page, page_size: PAGE_SIZE }),
    materialTaxonomy(),
  ])

  return (
    <TonView
      rows={rows}
      total={total}
      counts={counts}
      page={page}
      groups={tax.groups.map((g) => g.name)}
      filters={{ q: sp.q ?? '', nhom: sp.nhom ?? '', loc: filter }}
    />
  )
}

