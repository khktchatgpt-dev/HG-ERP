import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { StockManager } from './StockManager'

/**
 * Tồn kho — 3 cột Tồn / Đặt trước (LSX) / Khả dụng.
 *
 * `canEdit` theo QUYỀN THẬT (`warehouse.stock.write`) chứ không theo role:
 * bản cũ `admin || manager` vừa GIẤU nút với nhân viên Kho (warehouse_staff có
 * warehouse.edit — API cho ghi mà UI không cho bấm), vừa BÀY nút cho quản lý
 * phòng khác (bấm là ăn 403). Server vẫn enforce — đây chỉ là ẩn/hiện.
 *
 * `?low=1` / `?short=1`: deep-link từ dashboard + thông báo "Quét sáng" — vào
 * là lọc sẵn đúng danh sách đang được nói tới.
 */
export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ low?: string; short?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))
  // ?low=1 lọc Ở SERVER (low_only) — trang chỉ nạp 1000 mã đầu, vật tư dưới
  // min ngoài trang đầu mà lọc client là lọt lưới đúng lúc đang cần nhìn nó.
  const stock = await stockService.listStock(user, { low_only: !!sp.low })
  return (
    <StockManager
      stock={stock}
      canEdit={canEdit}
      initialStatus={sp.low ? 'low' : sp.short ? 'short' : null}
    />
  )
}
