import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isHRStaff } from '@/modules/dept/hr/hr.service'
import { LeaveScreen } from './LeaveScreen'

export default async function HRLeavePage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: 'mine' | 'pending' | 'all' }>
}) {
  const sp = await searchParams
  const scope = sp.scope ?? 'pending'

  // Danh sách "chờ duyệt" / "tất cả" chỉ dành cho người duyệt (manager/admin)
  // hoặc HR. NV thường mở /hr/leave → đưa về "đơn của tôi" cho đúng URL
  // (LeaveScreen vẫn tự lùi 'mine' như lớp phòng thủ nếu qua được đây).
  if (scope !== 'mine') {
    const user = (await authService.currentUser())!
    const canView =
      user.role === 'manager' || user.role === 'admin' || (await isHRStaff(user))
    if (!canView) redirect('/hr/leave/mine')
  }

  return <LeaveScreen scope={scope} />
}
