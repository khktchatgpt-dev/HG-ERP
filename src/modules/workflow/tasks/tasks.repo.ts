import { db } from '@/server/db'

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'submitted'
  | 'done'
  | 'rejected'
  | 'cancelled'
  | 'on_hold'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskKind = 'assigned' | 'self'

export type Task = {
  id: string
  task_code: string
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  kind: TaskKind
  assigner_id: string
  assignee_id: string
  department_id: string | null
  due_date: string | null
  planned_date: string | null
  category: string | null
  tags: string[]
  estimate_hours: number | null
  actual_hours: number | null
  progress_percent: number
  period_month: string | null
  parent_id: string | null
  started_at: string | null
  submitted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export type TaskRow = Task & {
  assignee_name: string | null
  assignee_email: string
  assigner_name: string | null
  assigner_email: string
  department_name: string | null
}

const BASE_COLS =
  'id, task_code, title, description, status, priority, kind, assigner_id, assignee_id, department_id, due_date, planned_date, category, tags, estimate_hours, actual_hours, progress_percent, period_month, parent_id, started_at, submitted_at, completed_at, cancelled_at, created_at, updated_at'

const ROW_COLS = `${BASE_COLS}, assignee_name, assignee_email, assigner_name, assigner_email, department_name`

export type TaskInsert = {
  title: string
  description?: string | null
  assigner_id: string
  assignee_id: string
  department_id?: string | null
  priority?: TaskPriority
  kind?: TaskKind
  due_date?: string | null
  planned_date?: string | null
  category?: string | null
  tags?: string[]
  estimate_hours?: number | null
  parent_id?: string | null
  period_month?: string | null
}

export type TaskPatch = Partial<{
  title: string
  description: string | null
  assignee_id: string
  department_id: string | null
  priority: TaskPriority
  due_date: string | null
  status: TaskStatus
  planned_date: string | null
  category: string | null
  tags: string[]
  estimate_hours: number | null
  actual_hours: number | null
  progress_percent: number
  period_month: string | null
}>

export type ListFilter = {
  status?: TaskStatus
  kind?: TaskKind
  assignee_id?: string
  assigner_id?: string
  department_id?: string
  parent_id?: string | null    // null = root tasks only
  planned_from?: string         // YYYY-MM-DD inclusive
  planned_to?: string           // YYYY-MM-DD inclusive
  created_from?: string         // ISO timestamp
  created_to?: string           // ISO timestamp
  completed_from?: string
  completed_to?: string
  has_planned_date?: boolean
  exclude_status?: TaskStatus[]
  q?: string
  page: number
  page_size: number
  order?: 'created_desc' | 'planned_asc' | 'due_asc'
}

export const tasksRepo = {
  async findById(id: string): Promise<Task | null> {
    const { data } = await db()
      .from('tasks')
      .select(BASE_COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Task | null) ?? null
  },

  async findByIdEnriched(id: string): Promise<TaskRow | null> {
    const { data } = await db()
      .from('v_task_summary')
      .select(ROW_COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as TaskRow | null) ?? null
  },

  async list(filter: ListFilter): Promise<{ rows: TaskRow[]; total: number }> {
    let q = db().from('v_task_summary').select(ROW_COLS, { count: 'exact' })

    switch (filter.order ?? 'created_desc') {
      case 'planned_asc':
        q = q.order('planned_date', { ascending: true, nullsFirst: false })
             .order('priority', { ascending: false })
        break
      case 'due_asc':
        q = q.order('due_date', { ascending: true, nullsFirst: false })
        break
      default:
        q = q.order('created_at', { ascending: false })
    }

    if (filter.status) q = q.eq('status', filter.status)
    if (filter.kind) q = q.eq('kind', filter.kind)
    if (filter.assignee_id) q = q.eq('assignee_id', filter.assignee_id)
    if (filter.assigner_id) q = q.eq('assigner_id', filter.assigner_id)
    if (filter.department_id) q = q.eq('department_id', filter.department_id)
    if (filter.parent_id === null) q = q.is('parent_id', null)
    else if (filter.parent_id) q = q.eq('parent_id', filter.parent_id)
    if (filter.has_planned_date === true) q = q.not('planned_date', 'is', null)
    if (filter.has_planned_date === false) q = q.is('planned_date', null)
    if (filter.planned_from) q = q.gte('planned_date', filter.planned_from)
    if (filter.planned_to) q = q.lte('planned_date', filter.planned_to)
    if (filter.exclude_status?.length) {
      q = q.not('status', 'in', `(${filter.exclude_status.join(',')})`)
    }
    if (filter.created_from) q = q.gte('created_at', filter.created_from)
    if (filter.created_to) q = q.lte('created_at', filter.created_to)
    if (filter.completed_from) q = q.gte('completed_at', filter.completed_from)
    if (filter.completed_to) q = q.lte('completed_at', filter.completed_to)
    if (filter.q) {
      // search by title OR task_code
      q = q.or(`title.ilike.%${filter.q}%,task_code.ilike.%${filter.q}%`)
    }

    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)

    const { data, count } = await q
    return { rows: (data ?? []) as TaskRow[], total: count ?? 0 }
  },

  async listSubtasks(parentId: string): Promise<Task[]> {
    const { data } = await db()
      .from('tasks')
      .select(BASE_COLS)
      .eq('parent_id', parentId)
      .order('created_at', { ascending: true })
    return (data ?? []) as Task[]
  },

  async insert(row: TaskInsert): Promise<Task> {
    const { data, error } = await db()
      .from('tasks')
      .insert(row)
      .select(BASE_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert task failed')
    return data as Task
  },

  async patch(id: string, patch: TaskPatch): Promise<Task> {
    const { data, error } = await db()
      .from('tasks')
      .update(patch)
      .eq('id', id)
      .select(BASE_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update task failed')
    return data as Task
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('tasks').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  async countsByStatus(
    column: 'assignee_id' | 'assigner_id',
    userId: string,
  ): Promise<Record<TaskStatus, number>> {
    const { data } = await db().from('tasks').select('status').eq(column, userId)
    return tally(data as { status: TaskStatus }[] | null)
  },

  async countsByStatusGlobal(): Promise<Record<TaskStatus, number>> {
    const { data } = await db().from('tasks').select('status')
    return tally(data as { status: TaskStatus }[] | null)
  },

  async countOverdueForAssignee(userId: string): Promise<number> {
    const { count } = await db()
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('assignee_id', userId)
      .in('status', ['todo', 'in_progress', 'submitted'])
      .lt('due_date', new Date().toISOString())
    return count ?? 0
  },

  /** Department-wide status counts grouped by assignee. Used by /team page. */
  async deptMemberCounts(departmentId: string) {
    const { data } = await db()
      .from('tasks')
      .select('assignee_id, status')
      .eq('department_id', departmentId)
      .not('status', 'in', '(done,cancelled)')
    const map: Record<string, { todo: number; in_progress: number; submitted: number }> = {}
    for (const r of (data ?? []) as { assignee_id: string; status: TaskStatus }[]) {
      const m = (map[r.assignee_id] ??= { todo: 0, in_progress: 0, submitted: 0 })
      if (r.status === 'todo' || r.status === 'in_progress' || r.status === 'submitted') {
        m[r.status]++
      }
    }
    return map
  },
}

function tally(rows: { status: TaskStatus }[] | null): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 0,
    submitted: 0,
    done: 0,
    rejected: 0,
    cancelled: 0,
    on_hold: 0,
  }
  for (const row of rows ?? []) counts[row.status]++
  return counts
}
