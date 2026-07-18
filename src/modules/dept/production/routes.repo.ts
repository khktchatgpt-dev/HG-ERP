import { db } from '@/server/db'

export type RouteRow = {
  order_line_id: string
  stages: string[]
}

function toStages(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
}

/**
 * Lộ trình giai đoạn per (lệnh × dòng SP) — snapshot lúc định hình (0063).
 * Cùng triết lý bảng chi tiết (components.repo): ghi đè trọn bộ theo lệnh.
 */
export const routesRepo = {
  async listByLsx(lsxId: string): Promise<RouteRow[]> {
    const { data, error } = await db()
      .from('production_order_routes')
      .select('order_line_id, stages')
      .eq('production_order_id', lsxId)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      order_line_id: r.order_line_id,
      stages: toStages(r.stages),
    }))
  },

  /** Ghi đè trọn bộ lộ trình của lệnh (delete + insert, pattern replaceAll). */
  async replaceAll(lsxId: string, rows: RouteRow[]): Promise<void> {
    const del = await db()
      .from('production_order_routes')
      .delete()
      .eq('production_order_id', lsxId)
    if (del.error) throw new Error(del.error.message)
    if (!rows.length) return
    const ins = await db()
      .from('production_order_routes')
      .insert(
        rows.map((r) => ({
          production_order_id: lsxId,
          order_line_id: r.order_line_id,
          stages: r.stages,
        })),
      )
    if (ins.error) throw new Error(ins.error.message)
  },

  /** Lộ trình MẶC ĐỊNH trên SP (technical_products.stage_route). */
  async productDefaults(productIds: string[]): Promise<Map<string, string[]>> {
    if (!productIds.length) return new Map()
    const { data, error } = await db()
      .from('technical_products')
      .select('id, stage_route')
      .in('id', productIds)
    if (error) throw new Error(error.message)
    return new Map((data ?? []).map((p) => [p.id, toStages(p.stage_route)]))
  },

  /**
   * HỢP các giai đoạn trong lộ trình per LSX — cho select "Cập nhật giai đoạn"
   * chỉ hiện giai đoạn có SP đi qua. Lệnh không có trong map = chưa định hình.
   */
  async stageUnionsByLsx(): Promise<Map<string, Set<string>>> {
    const { data } = await db()
      .from('production_order_routes')
      .select('production_order_id, stages')
      .limit(20000)
    const map = new Map<string, Set<string>>()
    for (const r of (data ?? []) as { production_order_id: string; stages: unknown }[]) {
      const set = map.get(r.production_order_id) ?? new Set<string>()
      for (const s of toStages(r.stages)) set.add(s)
      map.set(r.production_order_id, set)
    }
    return map
  },

  /** Số dòng SP đã có lộ trình per LSX — cho màn danh sách định hình. */
  async countsByLsx(): Promise<Map<string, number>> {
    const { data } = await db()
      .from('production_order_routes')
      .select('production_order_id')
      .limit(20000)
    const map = new Map<string, number>()
    for (const r of (data ?? []) as { production_order_id: string }[]) {
      map.set(r.production_order_id, (map.get(r.production_order_id) ?? 0) + 1)
    }
    return map
  },

  async saveProductDefault(productId: string, stages: string[]): Promise<void> {
    const { error } = await db()
      .from('technical_products')
      .update({ stage_route: stages })
      .eq('id', productId)
    if (error) throw new Error(error.message)
  },
}
