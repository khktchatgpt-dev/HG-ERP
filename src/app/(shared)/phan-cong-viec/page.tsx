import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import {
  GIVEN_FILTERS,
  MINE_FILTERS,
  canAssign,
  filterHolding,
  matchesGiven,
  matchesMine,
} from '@/lib/task-flow'
import { todayVn } from '@/lib/date-vn'
import { PhanCongScreen, type PhanCongFocus } from './PhanCongScreen'

export const metadata = { title: 'Phân công việc' }
export const dynamic = 'force-dynamic'

/**
 * PHÂN CÔNG VIỆC — trang DÙNG CHUNG (mọi người đăng nhập vào được, giữ sidebar
 * phòng mình). Sếp và quản lý giao việc, người nhận báo hoàn thành, người giao
 * duyệt Đạt (luật ở `@/lib/task-flow`, chốt 30/10/2026).
 *
 * Tải song song; danh sách người nhận (~37 người, chỉ tên + phòng) chỉ tải cho
 * người giao được việc. `?viec=<id>` là đường chuông mở (`taskHref`): trang chọn
 * sẵn mục + chip đang chứa việc đó và tô dòng.
 */
export default async function PhanCongPage({
  searchParams,
}: {
  searchParams: Promise<{ viec?: string }>
}) {
  const [{ viec }, user] = await Promise.all([
    searchParams,
    authService.requirePageUser(),
  ])
  const giver = canAssign(user)
  const [board, mine, people] = await Promise.all([
    tasksService.givenBoard(user),
    tasksService.mineBoard(user),
    giver ? tasksService.assignees() : Promise.resolve([]),
  ])
  const today = todayVn()

  // Một việc chỉ nằm ở MỘT phía (không ai tự giao cho mình). Không thấy ở đâu — đã
  // xoá, đã đóng quá 30 ngày, hay không phải việc của mình — thì mở trang như thường.
  let focus: PhanCongFocus | null = null
  const mineHit = viec ? mine.items.find((t) => t.id === viec) : undefined
  const givenHit = viec ? board?.items.find((t) => t.id === viec) : undefined
  if (mineHit) {
    const f = filterHolding(MINE_FILTERS, (f) => matchesMine(mineHit, f, today))
    if (f) focus = { id: mineHit.id, muc: 'cua-toi', filter: f }
  } else if (givenHit) {
    const f = filterHolding(GIVEN_FILTERS, (f) => matchesGiven(givenHit, f, today))
    if (f) focus = { id: givenHit.id, muc: 'giao', filter: f }
  }

  return (
    <PhanCongScreen
      // Bấm chuông khi ĐANG ở trang này: Next giữ nguyên màn (cùng tuyến) nên mục /
      // chip cũ ở lại. Đổi `key` theo việc chuông chỉ → màn dựng lại đúng chỗ (đo 30/10).
      key={viec ?? ''}
      meId={user.id}
      today={today}
      board={board}
      mine={mine}
      people={people}
      focus={focus}
    />
  )
}
