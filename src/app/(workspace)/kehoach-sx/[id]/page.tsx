import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { canManagePlan, isProductionStaff } from '@/modules/dept/production/perms'
import { HttpError } from '@/server/http'
import { PlanEditor } from './PlanEditor'

export const dynamic = 'force-dynamic'

/** Lên kế hoạch 1 lệnh: per dòng SP — lộ trình công đoạn + giao tổ + hạn. */
export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = (await authService.currentUser())!
  // Màn ĐIỀU PHỐI (0086): thành viên xưởng thường không xem — về màn của vai.
  const canEdit = await canManagePlan(user)
  if (user.role === 'employee' && !canEdit && (await isProductionStaff(user))) {
    redirect('/to')
  }
  let data
  try {
    data = await planService.get(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  return <PlanEditor data={data} canEdit={canEdit} />
}
