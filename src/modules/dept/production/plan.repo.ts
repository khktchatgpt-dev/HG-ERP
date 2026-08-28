import { db } from '@/server/db'

/**
 * Lộ trình MẶC ĐỊNH per SP (technical_products.stage_route, jsonb mảng code
 * công đoạn — 0063). Kế hoạch dùng làm gợi ý điền sẵn khi lên kế hoạch lệnh;
 * "lưu làm mặc định" ghi ngược lại đây.
 */

function toStages(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  const arr = v.filter((s): s is string => typeof s === 'string')
  return arr.length ? arr : null
}

export const planRepo = {
  /** product_id → lộ trình mặc định (null = SP chưa có). */
  async defaultRoutesByProducts(productIds: string[]): Promise<Map<string, string[]>> {
    if (!productIds.length) return new Map()
    const { data } = await db()
      .from('technical_products')
      .select('id, stage_route')
      .in('id', productIds)
    const map = new Map<string, string[]>()
    for (const p of (data ?? []) as { id: string; stage_route: unknown }[]) {
      const stages = toStages(p.stage_route)
      if (stages) map.set(p.id, stages)
    }
    return map
  },

  async saveDefaultRoute(productId: string, stages: string[]): Promise<void> {
    const { error } = await db()
      .from('technical_products')
      .update({ stage_route: stages })
      .eq('id', productId)
    if (error) throw new Error(error.message)
  },

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
