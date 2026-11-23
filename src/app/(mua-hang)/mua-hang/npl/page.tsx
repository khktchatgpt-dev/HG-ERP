import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { loadNplTheoLenh } from '@/modules/dept/supply/npl-theo-lenh.service'
import { todayVn, TZ_VN } from '@/lib/date-vn'
import { parseScope } from '@/lib/supply-scope'
import { NplScreen } from './NplScreen'
import { tabHopLe } from './npl.shared'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · NPL theo lệnh' }

/**
 * NPL THEO LỆNH — mọi dòng NPL trên đơn mua của các lệnh đang chạy, một bảng
 * (bản vẽ 8J3ZmaBWGeFGiutrVCcrgY duyệt 20/11/2026; bản 2 gọn lại
 * BTz7xg1pDUSuevLAmG3ec7 duyệt 21/11/2026). Quyền vào do layout khu Mua hàng
 * gác (`canEnterWorkspace(user, 'planning')`); trang chỉ đọc.
 *
 * Bản 3 (21/11/2026, 7pdeBVx9PykFpfZAK8x33K): tab đầu "Còn phải đặt" từ định
 * mức ngũ kim + bao bì, mở màn vào tab đó (Q1).
 *
 * PHẠM VI MẶC ĐỊNH (bản 2 · Q1): người mua mở là "Của tôi"; người duyệt đơn mua,
 * trưởng phòng (xem mọi đơn) và quản trị mở là "Cả phòng". `?pham_vi=` thắng
 * mặc định — cùng tham số với Bàn làm việc.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; pham_vi?: string }>
}) {
  const [sp, user] = await Promise.all([searchParams, authService.requirePageUser()])
  const today = todayVn()
  const [data, canApprove, canAll] = await Promise.all([
    loadNplTheoLenh(today),
    user.role === 'admin' ? true : canAction(user, 'supply.po.approve'),
    user.role === 'admin' ? true : canAction(user, 'supply.po.manage_any'),
  ])
  const capNhat = new Date().toLocaleTimeString('vi-VN', {
    timeZone: TZ_VN,
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <NplScreen
      rows={data.rows}
      lenh={data.lenh}
      can={data.can}
      soDon={data.soDon}
      today={today}
      capNhat={capNhat}
      tabDau={tabHopLe(sp.tab)}
      meId={user.id}
      phamViDau={parseScope(sp.pham_vi) ?? (canApprove || canAll ? 'phong' : 'toi')}
    />
  )
}
