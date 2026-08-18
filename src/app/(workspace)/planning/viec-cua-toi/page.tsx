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
export default async function SupplyTodoPage() {
  const user = await authService.requirePageUser()
  const [{ rows }, supplyStaff] = await Promise.all([
    loadWatchPos(user),
    isSupplyStaff(user),
  ])
  return (
    <TodoScreen
      pos={rows}
      meId={user.id}
      today={todayIso()}
      canEdit={user.role === 'admin' || supplyStaff}
    />
  )
}
