import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadDaVe } from '@/modules/dept/supply/da-ve.repo'
import { defaultScope, parseScope } from '@/lib/supply-scope'
import { todayVn } from '@/lib/date-vn'
import { DaVeScreen } from './DaVeScreen'
import { taiGiaoNhan } from '../giao-nhan/tai-giao-nhan'

export const metadata = { title: 'Mua hàng · Theo dõi đơn hàng · Đã về' }
export const dynamic = 'force-dynamic'


/**
 * THEO DÕI ĐƠN HÀNG › ĐÃ VỀ (01/10/2026, bản vẽ G3 canvas "Cung ứng · Hàng về",
 * chủ dự án duyệt theo đề xuất).
 *
 * Câu màn trả lời: "hàng vừa về — ổn không, còn gì phải làm?". Một dòng = một
 * phiếu nhập theo đơn mua; kết quả đọc bằng `lib/da-ve` (một chỗ luật, có
 * test). Việc xử lý (giao bù, chốt thiếu, sự cố) làm ở HỘP GIAO NHẬN mở ngay
 * trên màn này (`?don=`, bản vẽ H1); kg cân thiếu ghi bổ sung tại dòng.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pham_vi?: string; don?: string; sua?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const today = todayVn()
  const [{ rows, truncatedAt }, canWrite, canApprove, giaoNhan] = await Promise.all([
    // Nạp MỌI phiếu (04/10/2026, bản vẽ J2 — lọc "Tất cả" + "Phiếu tôi lập"): màn
    // lọc 7 / 14 / 30 ngày / tất cả trong tập này; trần 500 phiếu báo Cắt đuôi.
    loadDaVe(null),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    user.role === 'admin' ? Promise.resolve(true) : canAction(user, 'supply.po.approve'),
    // Hộp Giao nhận (bản vẽ H1) — "Mở để xử lý" mở ngay trên màn này.
    sp.don ? taiGiaoNhan(user, sp.don) : Promise.resolve(null),
  ])
  return (
    <DaVeScreen
      rows={rows}
      today={today}
      truncatedAt={truncatedAt}
      canWrite={canWrite}
      meId={user.id}
      defaultScope={defaultScope({ canApprove })}
      urlScope={parseScope(sp.pham_vi)}
      giaoNhan={giaoNhan}
      initialSua={sp.sua ?? null}
    />
  )
}
