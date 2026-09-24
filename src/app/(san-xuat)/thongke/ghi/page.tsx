import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  loadEntrySheet,
  worklistService,
} from '@/modules/dept/production/worklist.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { Btn, Empty } from '@/components/kit'
import { EntrySheetForm } from './EntrySheetForm'

export const dynamic = 'force-dynamic'

/**
 * GHI SẢN LƯỢNG — MỘT LỆNH MỘT LƯỢT, KHÔNG có màn chọn lệnh đứng trước.
 *
 * Lịch sử hai lần đảo, ghi lại để đừng đảo lần ba mà quên vì sao:
 *
 * - Tới 21/09/2026: có màn "Bước 1 chọn lệnh" chặn trước lưới. Chủ dự án chê
 *   "khó dùng và bất tiện" → bỏ.
 * - 21/09: đổi sang mở MỌI lệnh đang chạy, lệnh tụt xuống làm bộ lọc (theo cách
 *   SAP Fiori / D365 mở theo work center, lệnh chỉ là một cột).
 * - 22/09: chủ dự án chê tiếp — gộp nhiều lệnh vào một lưới là rối. Đo lại:
 *   công đoạn Phôi mở mọi lệnh ra **208 dòng của 8 lệnh**, kèm băng "chưa bày
 *   hết". Đúng là không gõ nổi.
 *
 * Bản này lấy phần đúng của cả hai: **phạm vi là MỘT lệnh** (hết trộn), nhưng
 * **không có màn chặn** — đổi lệnh bằng ô ngay đầu phiếu, đúng một lượt bấm.
 *
 * Lệnh mặc định: lệnh dùng lần trước (cookie `sx_ghi_lsx`), không có thì lệnh
 * còn NHIỀU VIỆC NHẤT. Dùng cookie chứ không localStorage vì server đọc được →
 * chọn xong render một lần, không nháy màn rồi nhảy sang lệnh khác.
 *
 * `?lsx=` vẫn ưu tiên cao nhất nên mọi liên kết cũ không gãy.
 */
export const GHI_LSX_COOKIE = 'sx_ghi_lsx'

export default async function GhiSanLuongPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string; stage?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  if (!canRecord) redirect('/thongke/lenh')

  // Danh sách lệnh phải có TRƯỚC để chọn lệnh mặc định, nên hai lượt tải này
  // không song song được nữa. Đổi lại lưới không bao giờ mở ra ở trạng thái
  // trộn 8 lệnh.
  const data = await worklistService.list(user, {})
  const remembered = (await cookies()).get(GHI_LSX_COOKIE)?.value ?? null
  const openable = data.lsx_cards
  const pick =
    openable.find((c) => c.lsx_id === sp.lsx)?.lsx_id ??
    openable.find((c) => c.lsx_id === remembered)?.lsx_id ??
    // Còn nhiều việc nhất = nơi thống kê nhiều khả năng phải ghi hôm nay.
    [...openable].sort((a, b) => b.open_count - a.open_count)[0]?.lsx_id ??
    null

  const sheet = await loadEntrySheet({ stage: sp.stage ?? null, lsxId: pick })

  if (!sheet) {
    return (
      <Empty
        headline="Chưa có việc nào để ghi sản lượng"
        reason="Lệnh phải được duyệt VÀ định hình chi tiết thì mới sinh ra dòng để ghi."
        next={
          <Btn icon="lenh" primary href="/thongke/lenh">
            Xem lệnh sản xuất
          </Btn>
        }
      />
    )
  }

  return (
    // KHÔNG có PageHeader: khuôn F cấm mọi hàng đầu trang thừa — mỗi hàng là
    // một hàng lưới bị lấy mất. Lớp token `.kit` do layout khu lo.
    <EntrySheetForm
      key={`${sp.lsx ?? 'all'}|${sheet.stage}`}
      sheet={sheet}
      userTeamId={user.department_id ?? null}
      lsxOptions={data.lsx_cards.map((c) => ({
        id: c.lsx_id,
        code: c.lsx_code,
        open_count: c.open_count,
      }))}
    />
  )
}
