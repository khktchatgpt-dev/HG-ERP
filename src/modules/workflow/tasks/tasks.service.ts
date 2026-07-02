import {
  tasksRepo,
  type Task,
  type TaskKind,
  type TaskPatch,
  type TaskPriority,
  type TaskStatus,
} from '@/modules/workflow/tasks/tasks.repo'
import { usersRepo, type User } from '@/modules/core/users/users.repo'
import { commentsRepo } from '@/modules/workflow/tasks/comments.repo'
import { activityRepo } from '@/modules/workflow/tasks/activity.repo'
import { notificationsService } from '@/modules/core/notifications/notifications.service'
import { emit } from '@/events/bus'
import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { assertCan } from '@/server/permissions'
import { BadRequest, Forbidden, NotFound } from '@/server/http'

type CreateInput = {
  title: string
  description?: string | null
  assignee_id: string
  department_id?: string | null
  priority?: TaskPriority
  due_date?: string | null
  planned_date?: string | null
  category?: string | null
  tags?: string[]
  estimate_hours?: number | null
  parent_id?: string | null
  period_month?: string | null
}

type UpdateInput = Partial<{
  title: string
  description: string | null
  assignee_id: string
  department_id: string | null
  priority: TaskPriority
  due_date: string | null
  planned_date: string | null
  category: string | null
  tags: string[]
  estimate_hours: number | null
  actual_hours: number | null
  progress_percent: number
  period_month: string | null
}>

// Status transitions an actor may perform manually (outside submit/approve/reject).
const ASSIGNED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['todo', 'on_hold', 'cancelled'],
  on_hold: ['in_progress', 'cancelled'],
  submitted: [],
  done: [],
  rejected: ['in_progress', 'on_hold', 'cancelled'],
  cancelled: ['todo'],
}

// Self tasks have no approval — owner can flip freely.
const SELF_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress', 'done', 'on_hold', 'cancelled'],
  in_progress: ['todo', 'done', 'on_hold', 'cancelled'],
  on_hold: ['in_progress', 'done', 'cancelled'],
  submitted: [],
  done: ['in_progress', 'todo'],
  rejected: ['in_progress'],
  cancelled: ['todo'],
}

async function loadAndAuthorize(
  id: string,
  user: User,
  action: Parameters<typeof assertCan>[1],
): Promise<Task> {
  const task = await tasksRepo.findById(id)
  if (!task) throw NotFound('Task not found')
  assertCan(user, action, { task })
  return task
}

export const tasksService = {
  async create(user: User, input: CreateInput): Promise<Task> {
    const isSelf = input.assignee_id === user.id
    const kind: TaskKind = isSelf ? 'self' : 'assigned'

    if (isSelf) {
      assertCan(user, 'task.create_self', { intendedAssigneeId: input.assignee_id })
    } else {
      assertCan(user, 'task.assign')
    }

    const assignee = await usersRepo.findById(input.assignee_id)
    if (!assignee || !assignee.is_active) {
      throw BadRequest('Assignee not found or inactive')
    }

    // Managers can only assign within their department.
    if (
      !isSelf &&
      user.role === 'manager' &&
      user.department_id &&
      assignee.department_id !== user.department_id
    ) {
      throw Forbidden('Cannot assign tasks to users outside your department')
    }

    if (input.parent_id) {
      const parent = await tasksRepo.findById(input.parent_id)
      if (!parent) throw BadRequest('Parent task not found')
      // Sub-task inherits department by default.
      if (input.department_id === undefined) input.department_id = parent.department_id
    }

    const task = await tasksRepo.insert({
      title: input.title,
      description: input.description ?? null,
      assigner_id: user.id,
      assignee_id: input.assignee_id,
      department_id: input.department_id ?? assignee.department_id ?? null,
      priority: input.priority ?? 'normal',
      kind,
      due_date: input.due_date ?? null,
      planned_date: input.planned_date ?? null,
      category: input.category ?? null,
      tags: input.tags ?? [],
      estimate_hours: input.estimate_hours ?? null,
      parent_id: input.parent_id ?? null,
      period_month: input.period_month ? `${input.period_month}-01` : null,
    })

    await activityRepo.log({
      task_id: task.id,
      actor_id: user.id,
      action: 'created',
      payload: { title: task.title, assignee_id: task.assignee_id, kind },
    })

    await emit({
      name: 'task.created',
      task_id: task.id,
      title: task.title,
      assigner_id: task.assigner_id,
      assignee_id: task.assignee_id,
      kind: task.kind as 'assigned' | 'self',
    })

    return task
  },

  async get(user: User, id: string) {
    const task = await tasksRepo.findByIdEnriched(id)
    if (!task) throw NotFound('Task not found')
    assertCan(user, 'task.view', { task })
    return task
  },

  async list(
    user: User,
    opts: {
      scope: 'mine' | 'assigned_by_me' | 'department' | 'all'
      status?: TaskStatus
      kind?: TaskKind
      q?: string
      page: number
      page_size: number
    },
  ) {
    const filter: Parameters<typeof tasksRepo.list>[0] = {
      page: opts.page,
      page_size: opts.page_size,
      status: opts.status,
      kind: opts.kind,
      q: opts.q,
    }
    if (opts.scope === 'mine') filter.assignee_id = user.id
    else if (opts.scope === 'assigned_by_me') filter.assigner_id = user.id
    else if (opts.scope === 'department') {
      if (!user.department_id) return { rows: [], total: 0 }
      filter.department_id = user.department_id
      if (user.role === 'employee') filter.assignee_id = user.id
    } else if (opts.scope === 'all') {
      if (user.role !== 'admin') throw Forbidden('Admins only')
    }

    return tasksRepo.list(filter)
  },

  // --- Plan helpers ---
  async myPlan(
    user: User,
    range: 'today' | 'week' | 'overdue' | 'upcoming' | 'all',
  ) {
    const today = new Date()
    const ymd = (d: Date) => d.toISOString().slice(0, 10)
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - ((today.getDay() + 6) % 7)) // Monday
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)

    const baseFilter = {
      assignee_id: user.id,
      page: 1,
      page_size: 200,
      exclude_status: undefined as undefined | ('done' | 'cancelled')[],
      order: 'planned_asc' as const,
    }

    if (range === 'today') {
      const { rows } = await tasksRepo.list({
        ...baseFilter,
        planned_from: ymd(today),
        planned_to: ymd(today),
      })
      return rows
    }
    if (range === 'week') {
      const { rows } = await tasksRepo.list({
        ...baseFilter,
        planned_from: ymd(startOfWeek),
        planned_to: ymd(endOfWeek),
      })
      return rows
    }
    if (range === 'overdue') {
      const { rows } = await tasksRepo.list({
        ...baseFilter,
        exclude_status: ['done', 'cancelled'],
        planned_to: ymd(new Date(today.getTime() - 86400_000)), // before today
        has_planned_date: true,
      })
      return rows
    }
    if (range === 'upcoming') {
      const { rows } = await tasksRepo.list({
        ...baseFilter,
        planned_from: ymd(new Date(endOfWeek.getTime() + 86400_000)),
      })
      return rows
    }
    const { rows } = await tasksRepo.list({ ...baseFilter, page_size: 200 })
    return rows
  },

  async update(user: User, id: string, patch: UpdateInput): Promise<Task> {
    const before = await loadAndAuthorize(id, user, 'task.update')
    const next: TaskPatch = { ...patch }

    if (patch.assignee_id && patch.assignee_id !== before.assignee_id) {
      const newAssignee = await usersRepo.findById(patch.assignee_id)
      if (!newAssignee || !newAssignee.is_active) {
        throw BadRequest('Assignee not found or inactive')
      }
      if (
        user.role === 'manager' &&
        user.department_id &&
        newAssignee.department_id !== user.department_id
      ) {
        throw Forbidden('Cannot reassign to users outside your department')
      }
    }

    // Normalize period_month (YYYY-MM → YYYY-MM-01 for DATE column)
    if (next.period_month && /^\d{4}-\d{2}$/.test(next.period_month)) {
      next.period_month = `${next.period_month}-01`
    }

    const task = await tasksRepo.patch(id, next)
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: patch.assignee_id ? 'reassigned' : 'updated',
      payload: patch as Record<string, unknown>,
    })
    if (patch.assignee_id && patch.assignee_id !== before.assignee_id) {
      await emit({
        name: 'task.reassigned',
        task_id: task.id,
        title: task.title,
        reassigned_by: user.id,
        new_assignee_id: patch.assignee_id,
      })
    }
    return task
  },

  async changeStatus(user: User, id: string, to: TaskStatus): Promise<Task> {
    const task = await tasksRepo.findById(id)
    if (!task) throw NotFound('Task not found')

    const isAssignee = task.assignee_id === user.id
    const isManager = user.role === 'manager' && task.assigner_id === user.id
    if (!isAssignee && !isManager && user.role !== 'admin') {
      throw Forbidden('Not allowed to change status')
    }

    const table = task.kind === 'self' ? SELF_TRANSITIONS : ASSIGNED_TRANSITIONS
    if (!table[task.status]?.includes(to)) {
      throw BadRequest(`Cannot transition from ${task.status} to ${to}`)
    }

    const next = await tasksRepo.patch(id, { status: to })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'status_changed',
      payload: { from: task.status, to },
    })
    return next
  },

  async submit(user: User, id: string): Promise<Task> {
    const task = await loadAndAuthorize(id, user, 'task.submit')
    if (!['todo', 'in_progress', 'rejected'].includes(task.status)) {
      throw BadRequest(`Cannot submit from status ${task.status}`)
    }
    const next = await tasksRepo.patch(id, { status: 'submitted' })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'status_changed',
      payload: { from: task.status, to: 'submitted' },
    })
    await emit({
      name: 'task.submitted',
      task_id: id,
      title: task.title,
      submitted_by: user.id,
      assigner_id: task.assigner_id,
    })
    return next
  },

  async approve(user: User, id: string): Promise<Task> {
    const task = await loadAndAuthorize(id, user, 'task.approve')
    if (task.status !== 'submitted') {
      throw BadRequest('Only submitted tasks can be approved')
    }
    const next = await tasksRepo.patch(id, { status: 'done' })
    await commentsRepo.insert({
      task_id: id,
      user_id: user.id,
      body: 'Approved',
      kind: 'approval',
    })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'status_changed',
      payload: { from: 'submitted', to: 'done' },
    })
    await emit({
      name: 'task.approved',
      task_id: id,
      title: task.title,
      approved_by: user.id,
      assignee_id: task.assignee_id,
    })
    return next
  },

  async reject(user: User, id: string, reason: string): Promise<Task> {
    const task = await loadAndAuthorize(id, user, 'task.approve')
    if (task.status !== 'submitted') {
      throw BadRequest('Only submitted tasks can be rejected')
    }
    const next = await tasksRepo.patch(id, { status: 'rejected' })
    await commentsRepo.insert({
      task_id: id,
      user_id: user.id,
      body: reason,
      kind: 'rejection',
    })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'status_changed',
      payload: { from: 'submitted', to: 'rejected', reason },
    })
    await emit({
      name: 'task.rejected',
      task_id: id,
      title: task.title,
      rejected_by: user.id,
      assignee_id: task.assignee_id,
      reason,
    })
    return next
  },

  async remove(user: User, id: string): Promise<void> {
    const task = await loadAndAuthorize(id, user, 'task.delete')
    await tasksRepo.delete(id)
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'deleted',
      payload: { title: task.title },
    })
  },

  // ---- comments
  async addComment(
    user: User,
    id: string,
    input: { body: string; kind: 'comment' | 'progress_report' },
  ) {
    const task = await loadAndAuthorize(id, user, 'task.view')
    await commentsRepo.insert({
      task_id: id,
      user_id: user.id,
      body: input.body,
      kind: input.kind,
    })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'commented',
      payload: { kind: input.kind },
    })
    const recipient =
      user.id === task.assignee_id ? task.assigner_id : task.assignee_id
    if (recipient !== user.id) {
      await emit({
        name: 'task.commented',
        task_id: id,
        title: task.title,
        comment_by: user.id,
        comment_kind: input.kind,
        recipient_ids: [recipient],
      })
    }
  },

  async listComments(user: User, id: string) {
    await loadAndAuthorize(id, user, 'task.view')
    return commentsRepo.listByTask(id)
  },

  async listActivity(user: User, id: string) {
    await loadAndAuthorize(id, user, 'task.view')
    return activityRepo.listByTask(id)
  },

  async listSubtasks(user: User, id: string) {
    await loadAndAuthorize(id, user, 'task.view')
    return tasksRepo.listSubtasks(id)
  },

  /** Quick progress update — anyone who can view + is assignee or assigner. */
  async setProgress(user: User, id: string, percent: number) {
    const task = await loadAndAuthorize(id, user, 'task.view')
    if (task.assignee_id !== user.id && task.assigner_id !== user.id && user.role !== 'admin') {
      throw Forbidden('Only the assignee or assigner can update progress')
    }
    const next = await tasksRepo.patch(id, { progress_percent: percent })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'updated',
      payload: { progress_percent: percent },
    })
    return next
  },

  /** Weekly report for a department (or org-wide for admin). */
  async weeklyReport(
    user: User,
    opts: { week_start?: string; department_id?: string },
  ) {
    const { db } = await import('@/server/db')
    let deptId = opts.department_id
    if (user.role === 'manager' || user.role === 'employee') {
      deptId = user.department_id ?? undefined
    }

    const start = opts.week_start
      ? new Date(opts.week_start + 'T00:00:00Z')
      : (() => {
          const d = new Date()
          d.setUTCHours(0, 0, 0, 0)
          d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
          return d
        })()
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 7)
    const nextWeekEnd = new Date(end)
    nextWeekEnd.setUTCDate(end.getUTCDate() + 7)

    const ymd = (d: Date) => d.toISOString().slice(0, 10)

    let memberQuery = db().from('users')
      .select('id, name, email, title, department_id')
      .eq('is_active', true)
      .order('name')
    if (deptId) memberQuery = memberQuery.eq('department_id', deptId)
    const { data: membersRaw } = await memberQuery
    const members = (membersRaw ?? []) as Array<{
      id: string; name: string | null; email: string; title: string | null; department_id: string | null
    }>

    const f = (assigneeId: string, extra: Partial<Parameters<typeof tasksRepo.list>[0]>) => ({
      assignee_id: assigneeId,
      page: 1,
      page_size: 1,           // we only need .total
      ...extra,
    } as Parameters<typeof tasksRepo.list>[0])

    const nowIso = new Date().toISOString()

    const rows = await Promise.all(
      members.map(async (m) => {
        const [assignedWeek, completedWeek, inProgress, dueNextWeek] = await Promise.all([
          tasksRepo.list(f(m.id, { created_from: start.toISOString(), created_to: end.toISOString() })),
          tasksRepo.list(f(m.id, { status: 'done', completed_from: start.toISOString(), completed_to: end.toISOString() })),
          tasksRepo.list(f(m.id, { status: 'in_progress' })),
          tasksRepo.list(f(m.id, { planned_from: ymd(end), planned_to: ymd(nextWeekEnd) })),
        ])
        const { count: overdueCount } = await db()
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('assignee_id', m.id)
          .in('status', ['todo', 'in_progress', 'submitted'])
          .lt('due_date', nowIso)

        return {
          user: m,
          assigned_in_week: assignedWeek.total,
          completed_in_week: completedWeek.total,
          in_progress: inProgress.total,
          overdue: overdueCount ?? 0,
          due_next_week: dueNextWeek.total,
        }
      }),
    )

    return {
      week: { start: ymd(start), end: ymd(new Date(end.getTime() - 1)) },
      department_id: deptId ?? null,
      rows,
    }
  },

  // ---- dashboard
  async dashboard(user: User) {
    const [mine, assignedByMe, overdueCount, unreadNotifs] = await Promise.all([
      tasksRepo.countsByStatus('assignee_id', user.id),
      tasksRepo.countsByStatus('assigner_id', user.id),
      tasksRepo.countOverdueForAssignee(user.id),
      notificationsService.unreadCount(user),
    ])
    return {
      mine,
      assigned_by_me: assignedByMe,
      overdue: overdueCount,
      unread_notifications: unreadNotifs,
    }
  },

  async orgStats(user: User) {
    if (user.role !== 'admin') throw Forbidden('Admins only')
    const [byStatus, userCount, departmentCount] = await Promise.all([
      tasksRepo.countsByStatusGlobal(),
      usersRepo.count(true),
      departmentsRepo.count(),
    ])
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
    return {
      by_status: byStatus,
      total,
      pending_approvals: byStatus.submitted,
      users: userCount,
      departments: departmentCount,
    }
  },
}
