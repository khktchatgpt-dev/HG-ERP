import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadDaVe } from '@/modules/dept/supply/da-ve.repo'
import { defaultScope, parseScope } from '@/lib/supply-scope'
import { todayVn } from '@/lib/date-vn'
import { DaVeScreen } from './DaVeScreen'

export const metadata = { title: 'Mua hàng · Theo dõi đơn hàng · Đã về' }
export const dynamic = 'force-dynamic'

/** Khoảng nạp tối đa — màn lọc 7 / 14 / 30 ngày trong tập này. */
const NGAY_TOI_DA = 30

/**
 * THEO DÕI ĐƠN HÀNG › ĐÃ VỀ (01/10/2026, bản vẽ G3 canvas "Cung ứng · Hàng về",
 * chủ dự án duyệt theo đề xuất).
 *
 * Câu màn trả lời: "hàng vừa về — ổn không, còn gì phải làm?". Một dòng = một
 * phiếu nhập theo đơn mua; kết quả đọc bằng `lib/da-ve` (một chỗ luật, có
 * test). Việc xử lý (giao bù, chốt thiếu, trao đổi NCC) làm ở TRANG ĐƠN — màn
 * này chỉ chỉ đường; riêng kg cân thiếu thì ghi bổ sung ngay tại đây.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pham_vi?: string }>
}) {
  const sp = await searchParams
  const user = await authService.requirePageUser()
  const today = todayVn()
  const since = new Date(Date.parse(today + 'T00:00:00Z') - NGAY_TOI_DA * 86_400_000)
    .toISOString()
    .slice(0, 10)
  const [{ rows, truncatedAt }, canWrite, canApprove] = await Promise.all([
    loadDaVe(since),
    user.role === 'admin'
      ? Promise.resolve(true)
      : canAction(user, 'warehouse.stock.write'),
    user.role === 'admin' ? Promise.resolve(true) : canAction(user, 'supply.po.approve'),
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
    />
  )
}
