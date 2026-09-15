import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import type { StockBucket } from '@/modules/dept/warehouse/stock.repo'
import { StockManager } from './StockManager'
import { PAGE_SIZE } from './constants'

/**
 * Tồn kho — 3 cột Tồn / Đặt trước (LSX) / Khả dụng.
 *
 * LỌC VÀ PHÂN TRANG Ở SERVER (Đợt 1 — `docs/thiet-ke-kho.md` §6).
 *
 * Bản cũ nạp CẢ 13.229 dòng xuống trình duyệt rồi lọc bằng `useMemo`: mỗi lần
 * mở màn là vài MB qua dây, và mặc định là một danh sách 13k dòng theo thứ tự
 * chữ cái mà không ai đọc hết. Đo 15/09/2026: chỉ 117 mã từng có phát sinh —
 * 99,1% số dòng nạp về là danh mục chưa động tới.
 *
 * MẶC ĐỊNH LÀ RỔ "ĐANG CÓ TỒN", không phải cả danh mục. Rổ "Cả danh mục" vẫn
 * còn và GHI RÕ con số, nên không ai tưởng bị giấu mất hàng.
 *
 * `canEdit` theo QUYỀN THẬT (`warehouse.stock.write`) chứ không theo role: bản
 * cũ `admin || manager` vừa GIẤU nút với nhân viên Kho (warehouse_staff có
 * warehouse.edit — API cho ghi mà UI không cho bấm), vừa BÀY nút cho quản lý
 * phòng khác (bấm là ăn 403). Server vẫn enforce — đây chỉ là ẩn/hiện.
 *
 * `?low=1` / `?short=1`: deep-link từ dashboard + thông báo "Quét sáng" — vào
 * là mở đúng rổ đang được nói tới.
 */
const BUCKETS: StockBucket[] = ['has', 'low', 'out', 'qc', 'blocked', 'short', 'all']

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{
    low?: string
    short?: string
    bucket?: string
    q?: string
    group?: string
    page?: string
  }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))

  // Deep-link cũ (?low=1 / ?short=1) vẫn chạy: nó chỉ là một cách viết khác của
  // ?bucket=. Giữ để thông báo và dashboard đã gửi đi không gãy.
  const bucket: StockBucket = sp.low
    ? 'low'
    : sp.short
      ? 'short'
      : BUCKETS.includes(sp.bucket as StockBucket)
        ? (sp.bucket as StockBucket)
        : 'has'

  const q = sp.q?.trim() || undefined
  const group = sp.group?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const [data, tax] = await Promise.all([
    stockService.listStockPage(user, {
      q,
      group_name: group,
      bucket,
      page,
      page_size: PAGE_SIZE,
    }),
    // Nhóm lấy từ taxonomy (danh sách CHỐT), không lấy từ trang kết quả — lấy
    // từ kết quả thì lọc xong dropdown chỉ còn một nhóm, hết đường chuyển.
    materialTaxonomy(),
  ])

  return (
    <StockManager
      stock={data.rows}
      total={data.total}
      counts={data.counts}
      groups={tax.groups.map((g) => g.name)}
      bucket={bucket}
      page={page}
      filters={{ q: sp.q ?? '', group: sp.group ?? '' }}
      canEdit={canEdit}
    />
  )
}
