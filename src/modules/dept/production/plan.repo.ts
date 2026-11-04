import { db } from '@/server/db'

/**
 * Nhật ký điều chỉnh kế hoạch (0169). Lộ trình MẶC ĐỊNH per SP
 * (`technical_products.stage_route`, 0063) từng đọc/ghi ở đây — BỎ 04/11/2026:
 * lộ trình sống ở cụm (hồ sơ SP + bản chụp trên lệnh), kế hoạch gợi ý từ bảng
 * định hình của lệnh (`plan.service.routesByLineFromShaping`). Cột
 * `stage_route` để nguyên trong DB, không nơi nào đọc nữa.
 */

export const planRepo = {
  /** Ghi 1 bản diff điều chỉnh kế hoạch (0169) — append-only. */
  async insertChange(row: {
    production_order_id: string
    production_order_line_id: string | null
    changes: PlanChangeDiff
    reason: string | null
    created_by: string
  }): Promise<void> {
    const { error } = await db().from('production_plan_changes').insert(row)
    if (error) throw new Error(error.message)
  },

  /** Nhật ký điều chỉnh của 1 lệnh — mới nhất trước, kèm tên người sửa. */
  async listChanges(lsxId: string): Promise<PlanChangeRow[]> {
    const { data } = await db()
      .from('production_plan_changes')
      .select(
        'id, production_order_line_id, changes, reason, created_at, actor:users(name)',
      )
      .eq('production_order_id', lsxId)
      .order('created_at', { ascending: false })
      .limit(200)
    type Raw = {
      id: string
      production_order_line_id: string | null
      changes: PlanChangeDiff
      reason: string | null
      created_at: string
      actor: { name: string | null } | { name: string | null }[] | null
    }
    return ((data ?? []) as unknown as Raw[]).map((r) => {
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return {
        id: r.id,
        production_order_line_id: r.production_order_line_id,
        changes: r.changes,
        reason: r.reason,
        created_at: r.created_at,
        actor_name: a?.name ?? null,
      }
    })
  },
}

/** Diff một lần điều chỉnh (0169). from/to của 'team' là ID tổ — UI tra tên. */
export type PlanChangeDiff = {
  added: string[]
  removed: string[]
  changed: {
    stage: string
    field: 'team' | 'planned_start' | 'planned_end'
    from: string | null
    to: string | null
  }[]
}

export type PlanChangeRow = {
  id: string
  production_order_line_id: string | null
  changes: PlanChangeDiff
  reason: string | null
  created_at: string
  actor_name: string | null
}
