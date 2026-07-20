import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'

export type NotificationType =
  | 'assigned'
  | 'reassigned'
  | 'status_changed'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'commented'
  | 'due_soon'
  | 'overdue'
  | 'quote_submitted'
  | 'quote_approved'
  | 'quote_rejected'
  | 'wh_receipt'
  | 'wh_stock_low'
  | 'po_submitted'
  | 'po_approved'
  | 'po_rejected'
  | 'lsx_submitted'
  | 'lsx_approved'
  | 'lsx_rejected'
  | 'order_changed'
  | 'order_cancelled'
  | 'stage_handoff'
  | 'incident_reported'
  | 'incident_resolved'

export type Notification = {
  id: string
  user_id: string
  actor_id: string | null
  task_id: string | null
  type: NotificationType
  payload: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export const notificationsRepo = {
  async insert(row: {
    user_id: string
    actor_id?: string | null
    task_id?: string | null
    type: NotificationType
    payload?: Record<string, unknown>
  }): Promise<void> {
    if (row.user_id === row.actor_id) return // don't notify self
    const { error } = await db()
      .from('notifications')
      .insert({ ...row, payload: (row.payload ?? {}) as Json })
    if (error) console.error('notification insert failed:', error.message)
  },

  async listForUser(
    userId: string,
    opts: { unreadOnly?: boolean; limit?: number } = {},
  ): Promise<Notification[]> {
    let q = db()
      .from('notifications')
      .select('id, user_id, actor_id, task_id, type, payload, read_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 50)
    if (opts.unreadOnly) q = q.is('read_at', null)
    const { data } = await q
    return (data ?? []) as Notification[]
  },

  async countUnread(userId: string): Promise<number> {
    const { count } = await db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null)
    return count ?? 0
  },

  async markRead(id: string, userId: string): Promise<void> {
    await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
  },

  async markAllRead(userId: string): Promise<void> {
    await db()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)
  },
}
