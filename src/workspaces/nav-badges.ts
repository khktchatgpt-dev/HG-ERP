import { canAction } from '@/modules/core/rbac/rbac.service'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { soPhieuRepo } from '@/modules/dept/warehouse/so-phieu.repo'
import { deNghiRepo } from '@/modules/dept/warehouse/de-nghi.repo'
import { choToiDuyet } from '@/lib/de-nghi-duyet'
import { productionRepo } from '@/modules/dept/production/production.repo'
import {
  componentsService,
  needsRoute,
} from '@/modules/dept/production/components.service'
import { transferDocsRepo } from '@/modules/dept/production/transfer-docs.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { choNhan } from '@/lib/pgt-tabs'
import { quotesRepo } from '@/modules/dept/sales/quotes.repo'
import { duyetLuongService } from '@/modules/dept/hr/luong/duyet-luong.service'
import { classifyTodo, countMyTodos, incomingBucket } from '@/lib/supply-watch'
import { defaultScope, isMyPo, myLsxIds } from '@/lib/supply-scope'
import { todayVn } from '@/lib/date-vn'
import { countMeetingIssues } from '@/modules/dept/supply/lsx-supply.service'
import { demLenhChoSoatKhongCho } from '@/modules/dept/supply/lenh-doi.service'
import { poReviewService } from '@/modules/dept/supply/po-review.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import type { User } from '@/modules/core/users/users.repo'
import type { NavBadge, WorkspaceId } from './workspaces.config'

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
): Promise<Record<string, NavBadge>> {
  // Nhóm VIỆC đứng đầu MỌI khu (B2) — đếm riêng, lỗi bên nào bên đó rỗng.
  const [viec, khu] = await Promise.all([
    viecBadges(user).catch(() => ({}) as Record<string, NavBadge>),
    khuBadges(user, workspaceId).catch(() => ({}) as Record<string, number>),
  ])
  return { ...viec, ...khu }
}

async function khuBadges(
  user: User,
  workspaceId: WorkspaceId,
): Promise<Record<string, number>> {
  if (workspaceId === 'exec') return await execBadges(user)
  if (workspaceId === 'planning') return await supplyBadges(user)
  if (workspaceId === 'warehouse') return await warehouseBadges()
  if (workspaceId === 'production' || workspaceId === 'thongke')
    return await productionBadges(user)
  return {}
}

/**
 * Nhóm VIỆC (B2, 05/11/2026): số ĐÚNG HÀM trang Phân công việc dùng cho hai tab —
 * "Việc của tôi" = `mineBoard.summary.doing` (+ ghi chú "k trễ" = `overdue`),
 * "Việc tôi giao" = `givenBoard.summary.to_approve` (chờ tôi duyệt; `givenBoard`
 * trả null cho người không giao được). Bảng `tasks` nhỏ, hai truy vấn rẻ.
 */
export async function viecBadges(user: User): Promise<Record<string, NavBadge>> {
  const [mine, given] = await Promise.all([
    tasksService.mineBoard(user),
    tasksService.givenBoard(user),
  ])
  const out: Record<string, NavBadge> = {}
  if (mine.summary.doing > 0) {
    out['/phan-cong-viec?muc=cua-toi'] = {
      n: mine.summary.doing,
      ...(mine.summary.overdue > 0 ? { note: `${mine.summary.overdue} trễ` } : {}),
    }
  }
  if (given && given.summary.to_approve > 0) {
    out['/phan-cong-viec?muc=giao'] = { n: given.summary.to_approve }
  }
  return out
}

/**
 * Khu Sản xuất (04/11/2026, menu xếp theo đường đi của lệnh):
 *   "Lộ trình công đoạn" = lệnh đang chạy còn cụm chưa khai lộ trình — đúng hàm trang
 *   `/thongke/lo-trinh` dùng (`componentsService.shapingOverview` + `needsRoute`);
 *   "Giao nhận" = phiếu giao tổ chờ TỔ CỦA NGƯỜI XEM nhận — cùng vị từ `choNhan`
 *   của tab "Chờ tôi nhận". Người không thuộc tổ xưởng thì không có số.
 */
async function productionBadges(user: User): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const rows = await componentsService.shapingOverview()
  const chuaLoTrinh = rows.filter(needsRoute).length
  if (chuaLoTrinh > 0) out['/thongke/lo-trinh'] = chuaLoTrinh

  if (user.department_id) {
    const depts = await departmentsRepo.list()
    const team = depts.find(
      (d) => d.id === user.department_id && d.workspace_id === 'production',
    )
    if (team) {
      const docs = await transferDocsRepo.listByLsxBulk(rows.map((r) => r.lsx.id))
      const n = docs.filter((d) => choNhan(d, team.id)).length
      if (n > 0) out['/thongke/giao-nhan'] = n
    }
  }
  return out
}

/**
 * Khu Kho: "Hàng về" = đơn QUÁ HẸN + HÔM NAY (Kho đợt 2 · Bước 1, 12/10/2026).
 *
 * Đếm bằng `incomingBucket` — đúng hàm trang `/warehouse/nhap` dùng để xếp mốc
 * và đếm ô "Quá hẹn"/"Hôm nay", cũng là hàm badge Theo dõi của Cung ứng. Kho xem
 * CẢ PHÒNG nên không lọc theo người phụ trách (khác badge bên Cung ứng).
 */
async function warehouseBadges(): Promise<Record<string, number>> {
  const today = todayVn()
  const [rows, thieu] = await Promise.all([
    posRepo.listWatchFields(),
    // Sổ phiếu: phiếu nhập thiếu số phiếu NCC có ngày CT trong 14 ngày — đúng
    // số ô "… trong 14 ngày" trên đầu Sổ phiếu (cùng `thieuSoNcc`, Bước 2b).
    soPhieuRepo.thieuSoNcc(today),
  ])
  const ganVe = rows.filter((p) => {
    const b = incomingBucket(p, today)
    return b === 'overdue' || b === 'today'
  }).length
  const out: Record<string, number> = {}
  if (ganVe > 0) out['/warehouse/nhap'] = ganVe
  if (thieu.ganDay > 0) out['/warehouse/phieu'] = thieu.ganDay
  return out
}

/**
 * Đề nghị mua CHỜ CHÍNH NGƯỜI XEM duyệt — cùng `choToiDuyet` mà Hộp ký và trang
 * `/duyet/de-nghi` dùng (Đ5 · DN-6). 0 khi người xem không có quyền duyệt.
 */
async function deNghiChoToi(user: User): Promise<number> {
  if (!(await canAction(user, 'warehouse.request.approve'))) return 0
  return (await deNghiRepo.dangChoDuyet()).filter((r) => choToiDuyet(r, user)).length
}

/** Khu Giám đốc: "Chờ tôi phê duyệt" = PO + LSX + báo giá + đề nghị mua đang chờ ký. */
async function execBadges(user: User): Promise<Record<string, number>> {
  if (!(await canAction(user, 'exec.approvals.view'))) return {}
  const [pos, lsx, quotes, dnm, luong] = await Promise.all([
    posRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
    productionRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
    quotesRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
    deNghiChoToi(user),
    duyetLuongService.demChoToiDuyet(user),
  ])
  const total = pos.total + lsx.total + quotes.total + dnm + luong
  const out: Record<string, number> = {}
  if (total > 0) out['/exec/approvals'] = total
  return out
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
  const issues = await countMeetingIssues(
    today,
    owned ? myLsxIds(owned, user.id) : undefined,
  )
  // Hộp thư: mọi việc trong phạm vi (trang cộng đủ các làn).
  const todo = scope === 'toi' ? countMyTodos(rows, user.id, today) : inScope.filter((p) => classifyTodo(p, today)).length // prettier-ignore
  /*
    HREF BÁM VÀO MÀN MỚI (16/09/2026) — ba con số không đổi, chỉ đổi chỗ đậu:

      Chờ tôi xử lý     → Hộp thư đơn mua  (/mua-hang/hop-thu)
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
  /*
    "CHỜ TÔI KÝ" (Hộp ký H3 · Q27) — MỘT con số cho mọi phiếu chờ người duyệt
    đơn mua: đơn mua chờ duyệt + đề nghị mua của Kho (cùng luật Hộp ký). Sổ đề
    nghị mua không đếm nữa — trước đó một phiếu đề nghị hiện số ở hai mục.
  */
  if (canApprove) {
    const [pend, dnm] = await Promise.all([
      posRepo.list({ status: 'pending_approval', page: 1, page_size: 1 }),
      deNghiChoToi(user),
    ])
    const n = pend.total + dnm
    if (n > 0) out['/mua-hang/cho-ky'] = n
  }
  /*
    "CHỜ TÔI XEM" (bản 2, 06/11/2026 · Q7) — trưởng phòng Cung ứng: chỉ việc làm
    được NGAY = nháp trình được + đơn NV gửi thẳng GĐ mà anh CHƯA xem. Nháp còn
    thiếu và nháp bị trả lại chưa sửa vẫn bày trong hộp nhưng không lên số.
    Cùng người thấy mục menu (capability `supply.review`: supply.lead, không
    admin) và cùng phép đếm với số trên tab của hộp (`lamDuocNgay`).
  */
  if (user.role !== 'admin' && (await canAction(user, 'supply.po.manage_any'))) {
    const n = await poReviewService.choXemCount()
    if (n > 0) out['/mua-hang/cho-xem'] = n
  }
  if (todo > 0) out['/mua-hang/hop-thu'] = todo
  if (ganVe > 0) out['/mua-hang/theo-doi'] = ganVe
  if (issues > 0) out['/mua-hang'] = issues
  /*
    SOÁT THAY ĐỔI = số lệnh ĐỔI CHỜ SOÁT (02/11/2026; B2 đặt ở Kế hoạch mua, T1
    dời sang trang riêng) — đếm CẢ PHÒNG, cùng nguồn chip "Chờ soát" của trang
    `/mua-hang/soat` (`trangThaiChoSoat`):
    định mức / lệnh đổi thì cả phòng phải thấy, không chỉ người có đơn. Không
    chờ phép tính: lần đầu chưa có số thì menu bỏ trống, lần mở trang sau là có.
  */
  const choSoat = await demLenhChoSoatKhongCho()
  if (choSoat) out['/mua-hang/soat'] = choSoat
  return out
}
