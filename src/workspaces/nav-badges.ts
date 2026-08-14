import { canAction } from '@/modules/core/rbac/rbac.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import type { User } from '@/modules/core/users/users.repo'
import type { WorkspaceId } from './workspaces.config'

/**
 * Số đếm SỐNG trên sidebar — { href → count }, gắn vào nav qua `withNavBadges`.
 *
 * Hiện chỉ khu Giám đốc cần: "Chờ tôi phê duyệt · N" (PO + LSX đang
 * pending_approval). Đếm bằng 2 truy vấn count (page_size 1) — rẻ, và sidebar
 * nằm trong LAYOUT nên chỉ chạy lúc tải trang / router.refresh() (các thao tác
 * ký đều refresh nên số tự đúng lại sau mỗi chữ ký).
 *
 * Nuốt lỗi có chủ đích: sidebar không được chết vì một phép đếm trang trí.
 */
export async function resolveNavBadges(
  user: User,
  workspaceId: WorkspaceId,
): Promise<Record<string, number>> {
  if (workspaceId !== 'exec') return {}
  if (!(await canAction(user, 'exec.approvals.view'))) return {}
  try {
    const [pos, lsx, quotes] = await Promise.all([
      posRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
      productionRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
      quotesRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
    ])
    const total = pos.total + lsx.total + quotes.total
    return total > 0 ? { '/exec/approvals': total } : {}
  } catch {
    return {}
  }
}
