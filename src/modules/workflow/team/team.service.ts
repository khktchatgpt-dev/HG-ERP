import { db } from '@/server/db'
import { departmentsRepo, type Department } from '@/modules/core/departments/departments.repo'
import { tasksRepo } from '@/modules/workflow/tasks/tasks.repo'
import { type User } from '@/modules/core/users/users.repo'
import { Forbidden, NotFound } from '@/server/http'

export type TeamMember = {
  id: string
  name: string | null
  email: string
  title: string | null
  role: User['role']
  counts: { todo: number; in_progress: number; submitted: number; overdue: number }
}

export const teamService = {
  /** Department a user can view in /team. Admin can view any (defaults to first). */
  async resolveDeptFor(user: User, requestedDeptId?: string): Promise<Department> {
    if (user.role === 'admin') {
      if (requestedDeptId) {
        const d = await departmentsRepo.findById(requestedDeptId)
        if (!d) throw NotFound('Department not found')
        return d
      }
      const list = await departmentsRepo.list()
      if (list.length === 0) throw NotFound('No departments')
      return list[0]
    }
    const headed = await departmentsRepo.findHeadedBy(user.id)
    if (!headed) throw Forbidden('Bạn chưa được gán làm Trưởng phòng ban')
    return headed
  },

  async dashboard(user: User, requestedDeptId?: string) {
    const dept = await this.resolveDeptFor(user, requestedDeptId)

    // Active members of this dept.
    const { data: membersRaw } = await db()
      .from('users')
      .select('id, name, email, title, role, is_active')
      .eq('department_id', dept.id)
      .eq('is_active', true)
      .order('name')
    const members = (membersRaw ?? []) as Array<
      Pick<User, 'id' | 'name' | 'email' | 'title' | 'role' | 'is_active'>
    >

    const wip = await tasksRepo.deptMemberCounts(dept.id)

    // Overdue per member (single query) — count tasks with due_date < today by assignee.
    const nowIso = new Date().toISOString()
    const { data: overdueRows } = await db()
      .from('tasks')
      .select('assignee_id')
      .eq('department_id', dept.id)
      .in('status', ['todo', 'in_progress', 'submitted'])
      .lt('due_date', nowIso)
    const overdueMap: Record<string, number> = {}
    for (const r of (overdueRows ?? []) as { assignee_id: string }[]) {
      overdueMap[r.assignee_id] = (overdueMap[r.assignee_id] ?? 0) + 1
    }

    const memberRows: TeamMember[] = members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      title: m.title,
      role: m.role,
      counts: {
        todo: wip[m.id]?.todo ?? 0,
        in_progress: wip[m.id]?.in_progress ?? 0,
        submitted: wip[m.id]?.submitted ?? 0,
        overdue: overdueMap[m.id] ?? 0,
      },
    }))

    // Department aggregate
    const totals = memberRows.reduce(
      (acc, m) => ({
        todo: acc.todo + m.counts.todo,
        in_progress: acc.in_progress + m.counts.in_progress,
        submitted: acc.submitted + m.counts.submitted,
        overdue: acc.overdue + m.counts.overdue,
      }),
      { todo: 0, in_progress: 0, submitted: 0, overdue: 0 },
    )

    // Recent dept tasks for context.
    const { rows: recent } = await tasksRepo.list({
      department_id: dept.id,
      page: 1,
      page_size: 10,
      order: 'created_desc',
    })

    return { department: dept, members: memberRows, totals, recent }
  },
}
