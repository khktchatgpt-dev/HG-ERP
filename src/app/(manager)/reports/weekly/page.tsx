import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { AppShell } from '@/components/AppShell'
import { WeeklyReportView } from './WeeklyReportView'

export default async function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ week_start?: string; dept?: string }>
}) {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const [report, departments] = await Promise.all([
    tasksService.weeklyReport(user, {
      week_start: sp.week_start,
      department_id: sp.dept,
    }),
    user.role === 'admin' ? departmentsService.list() : Promise.resolve([]),
  ])

  return (
    <AppShell title="Báo cáo tuần">
      <WeeklyReportView
        report={report}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        canPickDept={user.role === 'admin'}
      />
    </AppShell>
  )
}
