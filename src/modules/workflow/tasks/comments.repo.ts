import { db } from '@/server/db'

export type CommentKind =
  | 'comment'
  | 'progress_report'
  | 'approval'
  | 'rejection'
  | 'system'

export type Comment = {
  id: string
  task_id: string
  user_id: string
  body: string
  kind: CommentKind
  created_at: string
  user_name: string | null
  user_email: string
}

export const commentsRepo = {
  async listByTask(taskId: string): Promise<Comment[]> {
    const { data } = await db()
      .from('task_comments')
      .select(
        'id, task_id, user_id, body, kind, created_at, users:users!task_comments_user_id_fkey(name, email)',
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    type Raw = Omit<Comment, 'user_name' | 'user_email'> & {
      users: { name: string | null; email: string } | { name: string | null; email: string }[] | null
    }
    return ((data ?? []) as unknown as Raw[]).map((r) => {
      const u = Array.isArray(r.users) ? r.users[0] : r.users
      return {
        id: r.id,
        task_id: r.task_id,
        user_id: r.user_id,
        body: r.body,
        kind: r.kind,
        created_at: r.created_at,
        user_name: u?.name ?? null,
        user_email: u?.email ?? '',
      }
    })
  },

  async insert(row: {
    task_id: string
    user_id: string
    body: string
    kind: CommentKind
  }): Promise<void> {
    const { error } = await db().from('task_comments').insert(row)
    if (error) throw new Error(error.message)
  },
}
