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
}
