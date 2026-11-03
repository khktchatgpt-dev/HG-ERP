import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  loadEntrySheet,
  worklistService,
} from '@/modules/dept/production/worklist.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { Rong, SxKhung } from '@/app/(workspace)/production/_erp/khung'
import { GhiScreen } from './GhiScreen'

export const dynamic = 'force-dynamic'

/**
 * GHI SẢN LƯỢNG — MỘT LỆNH MỘT LƯỢT, KHÔNG có màn chọn lệnh đứng trước.
 *
 * Lịch sử hai lần đảo, ghi lại để đừng đảo lần ba mà quên vì sao:
 *
 * - Tới 21/09/2026: có màn "Bước 1 chọn lệnh" chặn trước lưới. Chủ dự án chê
 *   "khó dùng và bất tiện" → bỏ.
 * - 21/09: đổi sang mở MỌI lệnh đang chạy, lệnh tụt xuống làm bộ lọc.
 * - 22/09: chủ dự án chê tiếp — gộp nhiều lệnh vào một lưới là rối (208 dòng
 *   của 8 lệnh ở Phôi).
 *
 * Bản này lấy phần đúng của cả hai: phạm vi là MỘT lệnh, nhưng không có màn
 * chặn — đổi lệnh bằng chip ngay đầu phiếu.
 *
 * Lệnh mặc định: lệnh dùng lần trước (cookie `sx_ghi_lsx`), không có thì lệnh
 * còn NHIỀU VIỆC NHẤT. Cookie chứ không localStorage vì server đọc được →
 * render một lần đúng lệnh, không nháy. `?lsx=` ưu tiên cao nhất (link cũ).
 *
 * 03/11/2026 (B3): dựng lại KHÔNG kit theo cấu hình công đoạn — xem
 * `GhiScreen.tsx`.
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
  // không song song được.
  const data = await worklistService.list(user, {})
  const remembered = (await cookies()).get(GHI_LSX_COOKIE)?.value ?? null
  const openable = data.lsx_cards
  const pick =
    openable.find((c) => c.lsx_id === sp.lsx)?.lsx_id ??
    openable.find((c) => c.lsx_id === remembered)?.lsx_id ??
    [...openable].sort((a, b) => b.open_count - a.open_count)[0]?.lsx_id ??
    null

  const sheet = await loadEntrySheet({ stage: sp.stage ?? null, lsxId: pick })

  if (!sheet) {
    return (
      <SxKhung bare label="Ghi sản lượng">
        <Rong
          tieuDe="Chưa có việc nào để ghi sản lượng"
          lyDo="Lệnh phải được duyệt VÀ định hình chi tiết thì mới sinh ra dòng để ghi."
          tiep={
            <Link href="/thongke/lenh" className="sx-btn p">
              Xem lệnh sản xuất
            </Link>
          }
        />
      </SxKhung>
    )
  }

  return (
    <GhiScreen
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
