import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { AppShell } from '@/components/AppShell'
import { PlanBoard } from './PlanBoard'

export default async function PlanPage() {
  const user = await authService.currentUser()
  if (!user) redirect('/login')

  const [today, week, overdue, upcoming] = await Promise.all([
    tasksService.myPlan(user, 'today'),
    tasksService.myPlan(user, 'week'),
    tasksService.myPlan(user, 'overdue'),
    tasksService.myPlan(user, 'upcoming'),
  ])

  return (
    <AppShell
      title="Kế hoạch của tôi"
      subtitle="Tự lên lịch công việc cá nhân, không cần ai duyệt"
    >
      <PlanBoard
        initial={{ today, week, overdue, upcoming }}
        currentUserId={user.id}
      />
    </AppShell>
  )
}
