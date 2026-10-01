import { canAction } from '@/modules/core/rbac/rbac.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { classifyTodo, countMyTodos, incomingBucket } from '@/lib/supply-watch'
import { defaultScope, isMyPo, myLsxIds } from '@/lib/supply-scope'
import { todayVn } from '@/lib/date-vn'
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
  // Ngày theo giờ VN, cùng `todayVn()` các trang dùng — UTC làm badge và trang
  // lệch nhau từ 0h đến 7h sáng (đơn 'quá hẹn' ở trang mà badge chưa đếm).
  const today = todayVn()
  // "Vấn đề cần xử lý" đếm bằng đúng phép tính của trang (countMeetingIssues →
  // buildMeeting.issues), đường nhẹ không join — thêm 13/09/2026.
  /*
    PHẠM VI MẶC ĐỊNH THEO VAI (27/09/2026, lib/supply-scope): badge đếm ĐÚNG
    thứ trang đích hiện ra khi bấm vào mục menu — mục menu không mang tham số,
    nên trang mở theo phạm vi mặc định: người mua 'của tôi', người duyệt 'cả
    phòng'. (Ai đã tự đổi phạm vi trên máy thì trang theo lựa chọn đó — badge
    không đọc được máy người dùng, chấp nhận lệch trong trường hợp này.)
  */
  const canApprove = user.role === 'admin' || (await canAction(user, 'supply.po.approve'))
  const scope = defaultScope({ canApprove })
  const [rows, owned] = await Promise.all([posRepo.listWatchFields(), scope === 'toi' ? posRepo.listOwnership() : Promise.resolve(null)]) // prettier-ignore
  const inScope = scope === 'toi' ? rows.filter((p) => isMyPo(p, user.id)) : rows
  const issues = await countMeetingIssues(today, owned ? myLsxIds(owned, user.id) : undefined)
  // Hộp thư: mọi việc trong phạm vi (trang cộng đủ các làn).
  const todo = scope === 'toi' ? countMyTodos(rows, user.id, today) : inScope.filter((p) => classifyTodo(p, today)).length // prettier-ignore
  /*
    HREF BÁM VÀO MÀN MỚI (16/09/2026) — ba con số không đổi, chỉ đổi chỗ đậu:

      Chờ tôi xử lý     → Hộp thư việc  (/mua-hang/hop-thu)
      Hàng sắp về       → Theo dõi đơn hàng (/mua-hang/theo-doi, 01/10/2026):
                          đếm QUÁ HẸN + HÔM NAY trong phạm vi mặc định — đúng
                          hai làn đầu trang đích bày ra, bằng `incomingBucket`.
                          (Sáng 01/10 từng bỏ vì mục gộp vào Đơn mua mở cách xem
                          Tất cả; tách lại thành mục riêng thì số hứa đúng.)
      Vấn đề cần xử lý  → Bàn làm việc  (/mua-hang), nơi nó thành một khối

    Badge là { href → số }, mà ba href cũ vừa rời khỏi sidebar — để nguyên là
    ba phép đếm chạy mỗi lần mở trang rồi rơi vào hư không, và người mua mất
    đúng thứ khiến họ mở phần mềm lên: con số nói "có việc".
  */
  const ganVe = inScope.filter((p) => {
    const b = incomingBucket(p, today)
    return b === 'overdue' || b === 'today'
  }).length
  const out: Record<string, number> = {}
  if (todo > 0) out['/mua-hang/hop-thu'] = todo
  if (ganVe > 0) out['/mua-hang/theo-doi'] = ganVe
  if (issues > 0) out['/mua-hang'] = issues
  return out
}
