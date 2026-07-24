import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { canManagePlan, isProductionStaff } from '@/modules/dept/production/perms'
import { PlanList } from './PlanList'

export const dynamic = 'force-dynamic'

/**
 * KẾ HOẠCH SẢN XUẤT (vai Trưởng phòng Kế hoạch — 0084): hàng đợi lệnh đã
 * duyệt — lệnh chưa lên lộ trình nổi lên đầu; vào từng lệnh để lên lộ trình +
 * giao tổ + hạn; đặt ưu tiên ngay trên bảng.
 */
export default async function PlanPage() {
  const user = (await authService.currentUser())!
  // Màn ĐIỀU PHỐI (0086): thành viên xưởng thường không xem — về màn của vai.
  const canEditPlan = await canManagePlan(user)
  if (
    user.role === 'employee' &&
    !canEditPlan &&
    (await isProductionStaff(user))
  ) {
    redirect('/to')
  }
  const [{ rows }, canEdit] = await Promise.all([
    jobsService.overview(user),
    canManagePlan(user),
  ])
  return (
    <PlanList
      rows={rows.map((r) => ({
        id: r.lsx.id,
        code: r.lsx.code,
        order_code: r.lsx.order_code,
        customer_name: r.lsx.customer_name,
        status: r.lsx.status,
        priority: r.lsx.priority,
        ship_date: r.lsx.ship_date,
        late: r.lsx.late,
        jobs_total: r.jobs_total,
        jobs_done: r.jobs_done,
        plan_overdue: r.plan_overdue,
      }))}
      canEdit={canEdit}
    />
  )
}
