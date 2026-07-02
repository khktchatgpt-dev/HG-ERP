import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'

export type ActivityAction =
  | 'created'
  | 'updated'
  | 'reassigned'
  | 'status_changed'
  | 'commented'
  | 'attachment_added'
  | 'attachment_removed'
  | 'deleted'

export type ActivityEntry = {
  id: string
  task_id: string
  actor_id: string | null
  action: ActivityAction
  payload: Record<string, unknown>
  created_at: string
}

export const activityRepo = {
  async log(row: {
    task_id: string
    actor_id: string
    action: ActivityAction
    payload?: Record<string, unknown>
  }): Promise<void> {
    const { error } = await db()
      .from('activity_log')
      .insert({ ...row, payload: (row.payload ?? {}) as Json })
    if (error) console.error('activity log failed:', error.message)
  },

  async listByTask(taskId: string): Promise<ActivityEntry[]> {
    const { data } = await db()
      .from('activity_log')
      .select('id, task_id, actor_id, action, payload, created_at')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    return (data ?? []) as ActivityEntry[]
  },
}
