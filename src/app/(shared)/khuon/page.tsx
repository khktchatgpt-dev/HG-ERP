import { authService } from '@/modules/core/auth/auth.service'
import { dieCatalogRepo } from '@/modules/dept/technical/dies.repo'
import { canEditDies } from '@/modules/dept/technical/dies.service'
import { fileImageSrc } from '@/server/file-image'
import { KhuonListScreen } from './KhuonListScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Khuôn nhôm' }

/**
 * DANH MỤC KHUÔN NHÔM — khu DÙNG CHUNG.
 *
 * Kỹ thuật giữ và bổ sung, nhưng Cung ứng tra để đặt hàng và Sản xuất tra để
 * nhận dạng cây nhôm — nên nó ở `(shared)` như `/products`, không nhốt trong
 * workspace Kỹ thuật. Người xem giữ sidebar phòng mình.
 *
 * Kế hoạch + số đo: docs/quan-ly-khuon-ke-hoach.md
 *
 * Nạp CẢ danh mục một lượt (215 dòng): lọc và tìm chạy trong trình duyệt nên
 * bấm chip không phải chờ mạng, và số trên chip luôn bằng đúng số dòng hiện ra
 * — thứ sẽ lệch ngay nếu lọc ở server mà đếm ở client.
 */
export default async function Page() {
  const user = await authService.requirePageUser()

  const [rows, canEdit] = await Promise.all([dieCatalogRepo.listAll(), canEditDies(user)])

  /*
   * Ký URL ảnh ở SERVER. Chữ ký là HMAC theo id file (`@/server/file-image`) —
   * client không có khoá, và ký một lần ở đây giữ `src` ổn định giữa các lần
   * render, nên trình tối ưu ảnh không phải tính tiền lại mỗi lượt xem.
   */
  const imageUrls: Record<string, string> = {}
  for (const r of rows) {
    if (r.image_file_id) imageUrls[r.image_file_id] = fileImageSrc(r.image_file_id)
  }

  return <KhuonListScreen rows={rows} imageUrls={imageUrls} canEdit={canEdit} />
}
