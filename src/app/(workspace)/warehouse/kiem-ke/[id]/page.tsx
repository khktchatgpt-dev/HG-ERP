import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { HttpError } from '@/server/http'
import { DotScreen } from './DotScreen'

/**
 * MỘT ĐỢT KIỂM KÊ — Khuôn D (chứng từ) + F (lưới nhập liệu).
 *
 * Số sổ đã bị SERVER giấu nếu đợt đang đếm mù (xem `stocktakes.service`), nên
 * trang này không phải tự nhớ giấu gì — nó chỉ bày cái nhận được.
 */
export default async function DotPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await authService.requirePageUser()
  const { id } = await params

  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))

  /*
   * Lấy dữ liệu TRONG try, dựng JSX NGOÀI nó. React không render component
   * ngay lúc gặp JSX, nên lỗi khi render sẽ không rơi vào catch này — để JSX
   * bên trong là dựng một cái bẫy trông như đang bắt lỗi mà không bắt gì.
   */
  const data = await layChiTiet(user, id)
  return <DotScreen {...data} canEdit={canEdit} />
}

async function layChiTiet(
  user: Awaited<ReturnType<typeof authService.requirePageUser>>,
  id: string,
) {
  try {
    return await stocktakesService.detail(user, id)
  } catch (err) {
    // Đợt không tồn tại → trang 404 của Next, không phải màn lỗi đỏ.
    if (err instanceof HttpError && err.status === 404) notFound()
    throw err
  }
}
