import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { AppShell } from '@/components/AppShell'
import { db } from '@/server/db'
import { NewTaskForm } from './NewTaskForm'

export default async function NewTaskPage() {
  const user = await authService.currentUser()
  if (!user) redirect('/login')
  if (user.role !== 'manager' && user.role !== 'admin') redirect('/tasks')

  let query = db()
    .from('users')
    .select('id, email, name, department_id')
    .eq('is_active', true)
    .order('name')
  if (user.role === 'manager' && user.department_id) {
    query = query.eq('department_id', user.department_id)
  }
  const { data: candidates } = await query

  return (
    <AppShell title="Giao việc mới" subtitle="Tạo công việc và giao cho nhân viên">
      <div className="mx-auto max-w-2xl">
        <NewTaskForm
          candidates={(candidates ?? []).map((u) => ({
            id: u.id,
            label: u.name ?? u.email,
          }))}
        />
      </div>
    </AppShell>
  )
}
