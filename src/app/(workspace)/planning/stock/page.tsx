import { authService } from '@/modules/core/auth/auth.service'
import {
  listSupplyStock,
  type SupplyStockFilter,
} from '@/modules/dept/supply/supply-stock.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { SupplyStockScreen } from './SupplyStockScreen'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const FILTERS: SupplyStockFilter[] = ['incoming', 'in_stock', 'low', 'short', 'all']

/**
 * KHO & TỒN của Cung ứng — MÀN RIÊNG, không còn `export default` lại màn Tồn
 * kho của Kho (02/09/2026).
 *
 * Vì sao tách: màn Kho trả lời câu của thủ kho (còn bao nhiêu, nằm kệ nào).
 * Người mua cần thêm ba thứ mà màn đó không có, và thiếu chúng thì mỗi lần
 * quyết định phải mở 2-3 chỗ khác: ĐÃ ĐẶT CHƯA VỀ bao nhiêu (không có là đặt
 * trùng đơn tuần trước), BAO GIỜ VỀ + đơn nào, và LẦN TRƯỚC MUA của ai giá bao
 * nhiêu. Cùng lối `/planning/materials` đã tách thành view mua hàng của chính
 * danh mục vật tư dùng chung.
 *
 * Lọc/tìm/phân trang ĐI QUA URL để server lọc lại — xem lý do trong
 * `supply-stock.service.ts` (bản cũ dính trần 1.000 dòng và giấu mất đúng
 * những mã đang có tồn).
 */
export default async function PlanningStockPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string; f?: string; page?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const group = sp.group?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const filter = (
    FILTERS.includes(sp.f as SupplyStockFilter) ? sp.f : 'incoming'
  ) as SupplyStockFilter

  const [{ rows, total, counts }, tax] = await Promise.all([
    listSupplyStock(user, {
      q,
      group_name: group,
      filter,
      page,
      page_size: PAGE_SIZE,
    }),
    materialTaxonomy(),
  ])

  return (
    <SupplyStockScreen
      rows={rows}
      total={total}
      counts={counts}
      page={page}
      pageSize={PAGE_SIZE}
      groups={tax.groups}
      filters={{ q: sp.q ?? '', group: sp.group ?? '', f: filter }}
    />
  )
}
