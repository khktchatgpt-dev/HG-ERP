import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { canAssign } from '@/lib/task-flow'
import { todayVn } from '@/lib/date-vn'
import { PhanCongScreen } from './PhanCongScreen'

export const metadata = { title: 'Phân công việc' }
export const dynamic = 'force-dynamic'

/**
 * PHÂN CÔNG VIỆC — trang DÙNG CHUNG (mọi người đăng nhập vào được, giữ sidebar
 * phòng mình). Sếp và quản lý giao việc, người nhận báo hoàn thành, người giao
 * duyệt Đạt (luật ở `@/lib/task-flow`, chốt 30/10/2026).
 *
 * Tải song song; danh sách người nhận (~37 người, chỉ tên + phòng) chỉ tải cho
 * người giao được việc.
 */
export default async function PhanCongPage() {
  const user = await authService.requirePageUser()
  const giver = canAssign(user)
  const [board, people] = await Promise.all([
    tasksService.givenBoard(user),
    giver ? tasksService.assignees() : Promise.resolve([]),
  ])
  return <PhanCongScreen meId={user.id} today={todayVn()} board={board} people={people} />
}
