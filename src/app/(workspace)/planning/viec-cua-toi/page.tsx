import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadWatchPos, todayIso } from '../_data/watch'
import { TodoScreen } from './TodoScreen'

export const dynamic = 'force-dynamic'

/**
 * Hộp việc của Cung ứng. Không gác quyền riêng — cùng tập đơn mà màn danh sách
 * đã cho xem; `canEdit` chỉ để ẩn/hiện nút tạo phiếu (server vẫn enforce lại
 * trong pos.service như mọi thao tác khác).
 */
/**
 * BẢN SONG SONG `?v4=1` — kit v4 chạy cạnh bản cũ trên CÙNG dữ liệu, cùng
 * lõi phân loại (`groupTodos`). Người duyệt bấm qua lại so trực tiếp thay vì
 * so bằng trí nhớ; bản cũ không bị đụng nên gỡ về chỉ là bỏ tham số URL.
 */
export default async function SupplyTodoPage() {
  const user = await authService.requirePageUser()
  const [{ rows }, supplyStaff] = await Promise.all([
    loadWatchPos(user),
    isSupplyStaff(user),
  ])
  const props = {
    pos: rows,
    meId: user.id,
    today: todayIso(),
    canEdit: user.role === 'admin' || supplyStaff,
  }
  return <TodoScreen {...props} />
}
