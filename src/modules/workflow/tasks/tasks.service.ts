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
import { todayVn } from '@/lib/date-vn'
import {
  actionForStatus,
  ASSIGN_BLOCKED,
  canAssign,
  nextStatus,
  taskActionBlock,
  taskAttention,
  type TaskAction,
} from '@/lib/task-flow'

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

// Luật chuyển trạng thái: `@/lib/task-flow` (30/10/2026) — bảng ASSIGNED/SELF_TRANSITIONS cũ
// đã bỏ vì cho người nhận tự huỷ việc được giao.

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

/**
 * MỘT CỬA cho mọi bước trên việc (phân công việc, 30/10/2026): luật ai-bấm-được-gì
 * nằm ở `@/lib/task-flow` (thuần, có test). Sai người → 403, sai lúc → 400, câu
 * báo nói cách gỡ. Trước đây mỗi hàm tự kiểm một kiểu, và người nhận tự huỷ được
 * việc người khác giao cho mình qua `/status`.
 */
async function gate(user: User, id: string, action: TaskAction): Promise<Task> {
  const task = await tasksRepo.findById(id)
  if (!task) throw NotFound('Không thấy việc này')
  const block = taskActionBlock(task, action, { id: user.id, role: user.role })
  if (block) throw block.kind === 'who' ? Forbidden(block.message) : BadRequest(block.message)
  return task
}

export const tasksService = {
  async create(user: User, input: CreateInput): Promise<Task> {
    const isSelf = input.assignee_id === user.id
    const kind: TaskKind = isSelf ? 'self' : 'assigned'

    // Q1 — sếp + quản lý giao việc cho người khác; ai cũng tự ghi việc cho mình được.
    if (!isSelf && !canAssign(user)) throw Forbidden(ASSIGN_BLOCKED)

    const assignee = await usersRepo.findById(input.assignee_id)
    if (!assignee || !assignee.is_active || assignee.deleted_at) {
      throw BadRequest(`${assignee?.name ?? 'Người nhận'} không còn hoạt động — chọn người khác`)
    }
    // Q2 (30/10/2026): BỎ luật "quản lý chỉ giao trong phòng mình" — quản lý Cung ứng
    // cần thúc Sales, Kỹ thuật. Việc mang phòng CỦA NGƯỜI NHẬN (department_id bên
    // dưới) nên trưởng phòng người nhận vẫn thấy việc đó (`task.view`).

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
  async myPlan(user: User, range: 'today' | 'week' | 'overdue' | 'upcoming' | 'all') {
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
      if (!newAssignee || !newAssignee.is_active || newAssignee.deleted_at) {
        throw BadRequest(`${newAssignee?.name ?? 'Người nhận'} không còn hoạt động — chọn người khác`)
      }
      // Q2 — chuyển cho người phòng khác cũng được (bỏ luật cùng phòng 30/10/2026).
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
    const found = await tasksRepo.findById(id)
    if (!found) throw NotFound('Không thấy việc này')
    // Đường cũ `POST /status` đổi sang BƯỚC rồi đi qua đúng cửa của bước đó —
    // không còn đường vòng: việc được giao không tự đặt "xong" được (phải duyệt),
    // người nhận không tự huỷ được.
    const action = actionForStatus(found, to)
    if (!action) {
      throw BadRequest(
        found.kind === 'assigned' && to === 'done'
          ? 'Việc được giao chỉ xong khi người giao duyệt Đạt — hãy Báo hoàn thành'
          : 'Không đổi sang trạng thái này được',
      )
    }
    if (action === 'submit') return tasksService.submit(user, id, 'Xong')
    const task = await gate(user, id, action)

    const next = await tasksRepo.patch(id, { status: nextStatus(task, action) })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'status_changed',
      payload: { from: task.status, to },
    })
    return next
  },

  /**
   * Báo hoàn thành — Q4: bắt một câu kết quả (người giao cần biết đã làm gì mới
   * duyệt được). Câu đó lưu thành bình luận `progress_report` để còn vết.
   * Việc tự ghi thì báo xong là xong luôn, không qua duyệt.
   */
  async submit(user: User, id: string, result: string): Promise<Task> {
    const text = result.trim()
    if (!text) throw BadRequest('Ghi một câu kết quả để người giao biết đã làm gì')
    const task = await gate(user, id, 'submit')
    await commentsRepo.insert({ task_id: id, user_id: user.id, body: text, kind: 'progress_report' }) // prettier-ignore
    const to = nextStatus(task, 'submit')
    const next = await tasksRepo.patch(id, { status: to })
    await activityRepo.log({
      task_id: id,
      actor_id: user.id,
      action: 'status_changed',
      payload: { from: task.status, to, result: text },
    })
    if (task.kind === 'assigned') {
      await emit({
        name: 'task.submitted',
        task_id: id,
        title: task.title,
        submitted_by: user.id,
        assigner_id: task.assigner_id,
        result: text,
      })
    }
    return next
  },

  /** Q3 — việc được giao chỉ "xong" ở bước này: người giao (hoặc sếp) duyệt Đạt. */
  async approve(user: User, id: string, note?: string | null): Promise<Task> {
    const task = await gate(user, id, 'approve')
    const next = await tasksRepo.patch(id, { status: 'done' })
    await commentsRepo.insert({
      task_id: id,
      user_id: user.id,
      body: note?.trim() ? `Đạt — ${note.trim()}` : 'Đạt',
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
    if (!reason.trim()) throw BadRequest('Ghi lý do trả lại để người nhận biết phải làm thêm gì')
    const task = await gate(user, id, 'reject')
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
    const recipient = user.id === task.assignee_id ? task.assigner_id : task.assignee_id
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
    if (
      task.assignee_id !== user.id &&
      task.assigner_id !== user.id &&
      user.role !== 'admin'
    ) {
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
  async weeklyReport(user: User, opts: { week_start?: string; department_id?: string }) {
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

    let memberQuery = db()
      .from('users')
      .select('id, name, email, title, department_id')
      .eq('is_active', true)
      .order('name')
    if (deptId) memberQuery = memberQuery.eq('department_id', deptId)
    const { data: membersRaw } = await memberQuery
    const members = (membersRaw ?? []) as Array<{
      id: string
      name: string | null
      email: string
      title: string | null
      department_id: string | null
    }>

    const f = (
      assigneeId: string,
      extra: Partial<Parameters<typeof tasksRepo.list>[0]>,
    ) =>
      ({
        assignee_id: assigneeId,
        page: 1,
        page_size: 1, // we only need .total
        ...extra,
      }) as Parameters<typeof tasksRepo.list>[0]

    const nowIso = new Date().toISOString()

    const rows = await Promise.all(
      members.map(async (m) => {
        const [assignedWeek, completedWeek, inProgress, dueNextWeek] = await Promise.all([
          tasksRepo.list(
            f(m.id, { created_from: start.toISOString(), created_to: end.toISOString() }),
          ),
          tasksRepo.list(
            f(m.id, {
              status: 'done',
              completed_from: start.toISOString(),
              completed_to: end.toISOString(),
            }),
          ),
          tasksRepo.list(f(m.id, { status: 'in_progress' })),
          tasksRepo.list(
            f(m.id, { planned_from: ymd(end), planned_to: ymd(nextWeekEnd) }),
          ),
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
  /**
   * SỐ ĐỎ "Phân công việc": việc chờ tôi duyệt + việc của tôi quá hạn. Một truy
   * vấn gọn (chỉ cột luật cần); đếm bằng `taskAttention` — đúng phép mà danh
   * sách dùng để tô đỏ, nên số trên sidebar không nói khác danh sách.
   */
  async attention(user: User) {
    const rows = await tasksRepo.listForAttention(user.id)
    return taskAttention(rows, user.id, todayVn())
  },

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
