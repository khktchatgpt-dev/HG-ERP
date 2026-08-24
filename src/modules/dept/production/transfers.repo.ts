import { db } from '@/server/db'

/**
 * production_transfers (0090) — sổ bàn giao nội bộ APPEND-ONLY: giao (issue)
 * phôi/WIP vào tổ để làm 1 công đoạn / tổ trả lại (return) lỗi-thừa.
 * Tồn WIP tại tổ = đại lượng dẫn xuất (src/lib/production-summary.ts
 * summarizeTeamWip) — không lưu cứng, cùng triết lý outsource.
 */

export type Transfer = {
  id: string
  production_order_id: string
  component_id: string
  stage: string
  team_department_id: string
  direction: 'issue' | 'return'
  entry_date: string
  qty: number
  reason: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type TransferJoined = Transfer & {
  team_name: string | null
  component_name: string | null
  component_cluster: string | null
  created_by_name: string | null
  lsx_code: string | null
}

const COLS =
  'id, production_order_id, component_id, stage, team_department_id, direction, entry_date, qty, reason, note, created_by, created_at'
const SELECT_JOINED = `${COLS}, team:departments(name), component:production_components(name, cluster), actor:users(name), lsx:production_orders(code)`

type One<T> = T | T[] | null
type Raw = Transfer & {
  team: One<{ name: string }>
  component: One<{ name: string; cluster: string | null }>
  actor: One<{ name: string | null }>
  lsx: One<{ code: string }>
}

const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function unwrap(rows: Raw[] | null): TransferJoined[] {
  return (rows ?? []).map((r) => {
    const comp = first(r.component)
    return {
      ...r,
      team: undefined,
      component: undefined,
      actor: undefined,
      lsx: undefined,
      qty: Number(r.qty),
      team_name: first(r.team)?.name ?? null,
      component_name: comp?.name ?? null,
      component_cluster: comp?.cluster ?? null,
      created_by_name: first(r.actor)?.name ?? null,
      lsx_code: first(r.lsx)?.code ?? null,
    } as unknown as TransferJoined
  })
}

export const transfersRepo = {
  async findById(id: string): Promise<Transfer | null> {
    const { data } = await db()
      .from('production_transfers')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Transfer | null) ?? null
  },

  async listByLsx(productionOrderId: string): Promise<TransferJoined[]> {
    const { data } = await db()
      .from('production_transfers')
      .select(SELECT_JOINED)
      .eq('production_order_id', productionOrderId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Bàn giao của 1 LSX dạng thô (không join) — tính WIP khi ghi sổ sản lượng. */
  async listRawByLsx(productionOrderId: string): Promise<Transfer[]> {
    const { data } = await db()
      .from('production_transfers')
      .select(COLS)
      .eq('production_order_id', productionOrderId)
      .limit(20000)
    return ((data ?? []) as Transfer[]).map((r) => ({ ...r, qty: Number(r.qty) }))
  },

  /** Bàn giao thô của NHIỀU lệnh — tính WIP/nghẽn ở Toàn cảnh xưởng (GĐ3). */
  async listRawByLsxBulk(ids: string[]): Promise<Transfer[]> {
    if (!ids.length) return []
    const { data } = await db()
      .from('production_transfers')
      .select(COLS)
      .in('production_order_id', ids)
      .limit(50000)
    return ((data ?? []) as Transfer[]).map((r) => ({ ...r, qty: Number(r.qty) }))
  },

  async insert(row: Omit<Transfer, 'id' | 'created_at'>): Promise<void> {
    const { error } = await db().from('production_transfers').insert(row)
    if (error) throw new Error(error.message)
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('production_transfers').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
