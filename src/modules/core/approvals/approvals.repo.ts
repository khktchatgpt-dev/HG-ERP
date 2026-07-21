import { db } from '@/server/db'

/**
 * Lịch sử phê duyệt (audit) — append-only. Ghi bởi event handler khi
 * po.decided / lsx.decided (xem src/events/handlers/approval.audit.ts).
 */
export type ApprovalAction = 'approved' | 'rejected'
export type ApprovalEntityType = 'po' | 'lsx'

export type ApprovalEventInput = {
  entity_type: ApprovalEntityType
  entity_id: string
  entity_code: string
  action: ApprovalAction
  actor_id: string | null
  reason?: string | null
}

export type ApprovalEvent = {
  id: string
  entity_type: ApprovalEntityType
  entity_id: string
  entity_code: string
  action: ApprovalAction
  actor_id: string | null
  actor_name: string | null
  reason: string | null
  created_at: string
}

type ActorEmbed = { name: string | null; email: string } | null

export const approvalEventsRepo = {
  async log(input: ApprovalEventInput): Promise<void> {
    const { error } = await db()
      .from('approval_events')
      .insert({
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        entity_code: input.entity_code,
        action: input.action,
        actor_id: input.actor_id,
        reason: input.reason ?? null,
      })
    if (error) throw new Error(error.message)
  },

  async listRecent(filter: {
    entity_type?: ApprovalEntityType
    action?: ApprovalAction
    limit?: number
  }): Promise<ApprovalEvent[]> {
    let q = db()
      .from('approval_events')
      .select(
        'id, entity_type, entity_id, entity_code, action, actor_id, reason, created_at, actor:users(name, email)',
      )
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 300)
    if (filter.entity_type) q = q.eq('entity_type', filter.entity_type)
    if (filter.action) q = q.eq('action', filter.action)
    const { data } = await q

    type Raw = Omit<ApprovalEvent, 'actor_name'> & { actor: ActorEmbed | ActorEmbed[] }
    return ((data ?? []) as unknown as Raw[]).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return {
        id: r.id,
        entity_type: r.entity_type,
        entity_id: r.entity_id,
        entity_code: r.entity_code,
        action: r.action,
        actor_id: r.actor_id,
        actor_name: a?.name || a?.email || null,
        reason: r.reason,
        created_at: r.created_at,
      }
    })
  },
}
