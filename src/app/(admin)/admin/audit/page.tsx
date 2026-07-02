import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { db } from '@/server/db'
import { AuditLogView } from './AuditLogView'

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; target?: string; limit?: string }>
}) {
  const user = (await authService.currentUser())!
  const sp = await searchParams

  const limit = Math.min(500, Math.max(20, Number(sp.limit) || 100))

  let q = db()
    .from('user_audit_log')
    .select('id, target_user_id, actor_id, action, before, after, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sp.action) q = q.eq('action', sp.action)
  if (sp.actor) q = q.eq('actor_id', sp.actor)
  if (sp.target) q = q.eq('target_user_id', sp.target)

  const [{ data: entries }, users] = await Promise.all([
    q,
    usersService.list(user, { includeInactive: true, includeDeleted: true }),
  ])

  const userMap = new Map(users.map((u) => [u.id, u.name ?? u.email]))

  return (
    <AuditLogView
      entries={(entries ?? []).map((e) => ({
        id: e.id,
        target_user: userMap.get(e.target_user_id) ?? e.target_user_id.slice(0, 8),
        target_user_id: e.target_user_id,
        actor: e.actor_id ? userMap.get(e.actor_id) ?? '—' : 'Hệ thống',
        actor_id: e.actor_id,
        action: e.action,
        before: e.before as Record<string, unknown> | null,
        after: e.after as Record<string, unknown> | null,
        reason: e.reason,
        created_at: e.created_at,
      }))}
      users={users.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
      currentFilter={{
        action: sp.action ?? 'all',
        actor: sp.actor ?? 'all',
        target: sp.target ?? 'all',
        limit,
      }}
    />
  )
}
