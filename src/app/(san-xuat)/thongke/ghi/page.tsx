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
 * GHI SẢN LƯỢNG — MỞ THẲNG VÀO LƯỚI, không qua bước chọn lệnh (21/09/2026).
 *
 * BỎ MÀN "CHỌN LỆNH" đứng trước. Nó có từ 27/08 với lý do "đừng gộp mọi lệnh
 * vào một màn", nhưng đối chiếu bốn hệ ERP cho thấy cách đó chỉ giống NetSuite
 * — hệ duy nhất còn bắt chọn một lệnh trước khi nhập. SAP Fiori mở theo work
 * center và để lệnh làm ô tìm; D365 mở thẳng "All jobs" với LỆNH LÀ MỘT CỘT.
 *
 * Lý do thực tế: số lệnh một tổ đụng trong một ngày KHÔNG CỐ ĐỊNH (chủ dự án
 * 21/09). Bắt chọn lệnh trước nghĩa là hôm nào tổ làm ba lệnh thì phải đi qua
 * màn chọn ba lần, gõ vài dòng rồi quay ra.
 *
 * Nỗi lo cũ vẫn đúng và được giải bằng cách khác: lưới KHÔNG đổ hết mọi dòng —
 * nó lọc theo CÔNG ĐOẠN đang mở, gom theo lệnh, và còn ô lọc lệnh cho ai muốn
 * hẹp lại. `?lsx=` vẫn chạy nguyên nên mọi liên kết cũ không gãy.
 */
export default async function GhiSanLuongPage({
  searchParams,
}: {
  searchParams: Promise<{ lsx?: string; stage?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const canRecord = user.role === 'admin' || (await isProductionStaff(user))
  if (!canRecord) redirect('/thongke/lenh')

  const [sheet, data] = await Promise.all([
    loadEntrySheet({ stage: sp.stage ?? null, lsxId: sp.lsx ?? null }),
    worklistService.list(user, {}),
  ])

  if (!sheet) {
    return (
      <Empty
        headline="Chưa có việc nào để ghi sản lượng"
        reason="Lệnh phải được duyệt VÀ định hình chi tiết thì mới sinh ra dòng để ghi."
        next={
          <Btn primary href="/thongke/lenh">
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
