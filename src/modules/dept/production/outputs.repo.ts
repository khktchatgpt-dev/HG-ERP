import { db } from '@/server/db'

export type OutputEntry = {
  id: string
  production_order_id: string
  component_id: string
  stage: string
  team_department_id: string | null
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  machine_note: string | null
  note: string | null
  created_by: string | null
  created_at: string
  team_name: string | null
  created_by_name: string | null
}

const COLS =
  'id, production_order_id, component_id, stage, team_department_id, entry_date, qty, kg, defect_qty, machine_note, note, created_by, created_at'

type Raw = Omit<OutputEntry, 'team_name' | 'created_by_name'> & {
  team: { name: string } | { name: string }[] | null
  actor: { name: string | null } | { name: string | null }[] | null
}

function unwrap(rows: Raw[] | null): OutputEntry[] {
  return (rows ?? []).map((r) => {
    const t = Array.isArray(r.team) ? r.team[0] : r.team
    const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
    return {
      ...r,
      team: undefined,
      actor: undefined,
      team_name: t?.name ?? null,
      created_by_name: a?.name ?? null,
    } as unknown as OutputEntry
  })
}

export const outputsRepo = {
  async listByLsx(productionOrderId: string): Promise<OutputEntry[]> {
    const { data } = await db()
      .from('production_output_entries')
      .select(`${COLS}, team:departments(name), actor:users(name)`)
      .eq('production_order_id', productionOrderId)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(2000)
    return unwrap(data as Raw[] | null)
  },

  async insertMany(
    rows: {
      production_order_id: string
      component_id: string
      stage: string
      team_department_id: string | null
      entry_date: string
      qty: number
      kg: number | null
      defect_qty: number
      machine_note: string | null
      note: string | null
      created_by: string
    }[],
  ): Promise<void> {
    const { error } = await db().from('production_output_entries').insert(rows)
    if (error) throw new Error(error.message)
  },

  async findById(id: string): Promise<OutputEntry | null> {
    const { data } = await db()
      .from('production_output_entries')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as OutputEntry | null) ?? null
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('production_output_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** LSX đã có sản lượng chưa — guard chặn ghi đè bảng chi tiết. */
  async existsForLsx(productionOrderId: string): Promise<boolean> {
    const { count } = await db()
      .from('production_output_entries')
      .select('id', { count: 'exact', head: true })
      .eq('production_order_id', productionOrderId)
    return (count ?? 0) > 0
  },
}
