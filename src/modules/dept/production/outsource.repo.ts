import { db } from '@/server/db'

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
  supplier_name: string | null
  created_by_name: string | null
}

const COLS =
  'id, production_order_id, component_id, supplier_id, direction, entry_date, qty, kg, defect_qty, note, created_by, created_at'

type Raw = Omit<OutsourceEntry, 'supplier_name' | 'created_by_name'> & {
  supplier: { name: string } | { name: string }[] | null
  actor: { name: string | null } | { name: string | null }[] | null
}

export const outsourceRepo = {
  async listByLsx(productionOrderId: string): Promise<OutsourceEntry[]> {
    const { data } = await db()
      .from('production_outsource_entries')
      .select(`${COLS}, supplier:supply_suppliers(name), actor:users(name)`)
      .eq('production_order_id', productionOrderId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(2000)
    return ((data ?? []) as Raw[]).map((r) => {
      const s = Array.isArray(r.supplier) ? r.supplier[0] : r.supplier
      const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
      return {
        ...r,
        supplier: undefined,
        actor: undefined,
        supplier_name: s?.name ?? null,
        created_by_name: a?.name ?? null,
      } as unknown as OutsourceEntry
    })
  },

  async insert(row: {
    production_order_id: string
    component_id: string
    supplier_id: string
    direction: 'send' | 'receive'
    entry_date: string
    qty: number
    kg: number | null
    defect_qty: number
    note: string | null
    created_by: string
  }): Promise<void> {
    const { error } = await db().from('production_outsource_entries').insert(row)
    if (error) throw new Error(error.message)
  },

  async findById(id: string): Promise<OutsourceEntry | null> {
    const { data } = await db()
      .from('production_outsource_entries')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as OutsourceEntry | null) ?? null
  },

  async delete(id: string): Promise<void> {
    const { error } = await db()
      .from('production_outsource_entries')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
