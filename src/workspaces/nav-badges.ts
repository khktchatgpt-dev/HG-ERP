import { canAction } from '@/modules/core/rbac/rbac.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { countIncomingSoon, countMyTodos } from '@/lib/supply-watch'
import { countMeetingIssues } from '@/modules/dept/supply/lsx-supply.service'
import type { User } from '@/modules/core/users/users.repo'
import type { WorkspaceId } from './workspaces.config'

/**
 * Số đếm SỐNG trên sidebar — { href → count }, gắn vào nav qua `withNavBadges`.
 *
 * Đếm bằng truy vấn rẻ, và sidebar nằm trong LAYOUT nên chỉ chạy lúc tải trang /
 * router.refresh() (mọi thao tác đều refresh nên số tự đúng lại sau mỗi lần ký,
 * gửi, ghi nhận hàng về).
 *
 * Nuốt lỗi có chủ đích: sidebar không được chết vì một phép đếm trang trí.
 */
export async function resolveNavBadges(
  user: User,
  workspaceId: WorkspaceId,
): Promise<Record<string, number>> {
  try {
    if (workspaceId === 'exec') return await execBadges(user)
    if (workspaceId === 'planning') return await supplyBadges(user)
    return {}
  } catch {
    return {}
  }
}

/** Khu Giám đốc: "Chờ tôi phê duyệt" = PO + LSX + báo giá đang chờ ký. */
async function execBadges(user: User): Promise<Record<string, number>> {
  if (!(await canAction(user, 'exec.approvals.view'))) return {}
  const [pos, lsx, quotes] = await Promise.all([
    posRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
    productionRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
    quotesRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
  ])
  const total = pos.total + lsx.total + quotes.total
  return total > 0 ? { '/exec/approvals': total } : {}
}

/**
 * Khu Cung ứng: "Chờ tôi xử lý" và "Hàng sắp về".
 *
 * Hai con số phải cùng nguồn với hai màn tương ứng (`lib/supply-watch`) — badge
 * nói 5 mà mở ra thấy 7 là hỏng niềm tin vào cả sidebar. Vì thế đếm bằng đúng
 * hàm mà trang dùng, chứ không viết lại điều kiện ở đây.
 *
 * Nạp một lượt các cột nhẹ thay vì `posRepo.list` (kèm join NCC/LSX/người phụ
 * trách): badge chạy trên MỌI lần mở trang của khu này, không đáng ba cú join.
 */
async function supplyBadges(user: User): Promise<Record<string, number>> {
  const today = new Date().toISOString().slice(0, 10)
  // "Vấn đề cần xử lý" đếm bằng đúng phép tính của trang (countMeetingIssues →
  // buildMeeting.issues), đường nhẹ không join — thêm 13/09/2026.
  const [rows, issues] = await Promise.all([
    posRepo.listWatchFields(),
    countMeetingIssues(today),
  ])
  const todo = countMyTodos(rows, user.id, today)
  const soon = countIncomingSoon(rows, today)
  /*
    HREF BÁM VÀO MÀN MỚI (16/09/2026) — ba con số không đổi, chỉ đổi chỗ đậu:

      Chờ tôi xử lý     → Hộp thư việc  (/mua-hang/hop-thu)
      Hàng sắp về       → Nhận hàng     (/mua-hang/nhan-hang)
      Vấn đề cần xử lý  → Bàn làm việc  (/mua-hang), nơi nó thành một khối

    Badge là { href → số }, mà ba href cũ vừa rời khỏi sidebar — để nguyên là
    ba phép đếm chạy mỗi lần mở trang rồi rơi vào hư không, và người mua mất
    đúng thứ khiến họ mở phần mềm lên: con số nói "có việc".
  */
  const out: Record<string, number> = {}
  if (todo > 0) out['/mua-hang/hop-thu'] = todo
  if (soon > 0) out['/mua-hang/nhan-hang'] = soon
  if (issues > 0) out['/mua-hang'] = issues
  return out
}
