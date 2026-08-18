import { canAction } from '@/modules/core/rbac/rbac.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { countIncomingSoon, countMyTodos } from '@/lib/supply-watch'
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
  const rows = await posRepo.listWatchFields()
  const today = new Date().toISOString().slice(0, 10)
  const todo = countMyTodos(rows, user.id, today)
  const soon = countIncomingSoon(rows, today)
  const out: Record<string, number> = {}
  if (todo > 0) out['/planning/viec-cua-toi'] = todo
  if (soon > 0) out['/planning/hang-sap-ve'] = soon
  return out
}
