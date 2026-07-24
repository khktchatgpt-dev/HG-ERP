import { db } from '@/server/db'

/**
 * production_outsource_entries (0084) — sổ gia công ngoài APPEND-ONLY:
 * giao (send) / nhận về (receive) per chi tiết × NCC. Đối chiếu thiếu/dư
 * tính ở service (src/lib/production-summary.ts summarizeOutsource).
 */

export type OutsourceEntry = {
  id: string
  production_order_id: string
  component_id: string
  supplier_id: string
  direction: 'send' | 'receive'
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  note: string | null
  created_by: string | null
  created_at: string
}

export type OutsourceEntryJoined = OutsourceEntry & {
  supplier_name: string | null
  component_name: string | null
  created_by_name: string | null
}

const COLS =
  'id, production_order_id, component_id, supplier_id, direction, entry_date, qty, kg, defect_qty, note, created_by, created_at'
const SELECT_JOINED = `${COLS}, supplier:supply_suppliers(name), component:production_components(name), actor:users(name)`

type One<T> = T | T[] | null
type Raw = OutsourceEntry & {
  supplier: One<{ name: string }>
  component: One<{ name: string }>
  actor: One<{ name: string | null }>
}

const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function unwrap(rows: Raw[] | null): OutsourceEntryJoined[] {
  return (rows ?? []).map(
    (r) =>
      ({
        ...r,
        supplier: undefined,
        component: undefined,
        actor: undefined,
        qty: Number(r.qty),
        kg: r.kg == null ? null : Number(r.kg),
        defect_qty: Number(r.defect_qty),
        supplier_name: first(r.supplier)?.name ?? null,
        component_name: first(r.component)?.name ?? null,
        created_by_name: first(r.actor)?.name ?? null,
      }) as unknown as OutsourceEntryJoined,
  )
}

export const outsourceRepo = {
  async findById(id: string): Promise<OutsourceEntry | null> {
    const { data } = await db()
      .from('production_outsource_entries')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as OutsourceEntry | null) ?? null
  },

  async listByLsx(productionOrderId: string): Promise<OutsourceEntryJoined[]> {
    const { data } = await db()
      .from('production_outsource_entries')
      .select(SELECT_JOINED)
      .eq('production_order_id', productionOrderId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000)
    return unwrap(data as unknown as Raw[] | null)
  },

  async insert(row: Omit<OutsourceEntry, 'id' | 'created_at'>): Promise<void> {
    const { error } = await db().from('production_outsource_entries').insert(row)
    if (error) throw new Error(error.message)
  },

  async delete(id: string): Promise<void> {
    const { error } = await db()
      .from('production_outsource_entries')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
