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
  /** Code danh mục production_defect_codes (0067) — bản ghi cũ null. */
  defect_reason: string | null
  machine_note: string | null
  note: string | null
  created_by: string | null
  created_at: string
  team_name: string | null
  created_by_name: string | null
}

/** Dòng sổ toàn xưởng — kèm tên chi tiết + mã LSX để hiện không cần context lệnh. */
export type LogbookEntry = OutputEntry & {
  component_name: string | null
  lsx_code: string | null
}

const COLS =
  'id, production_order_id, component_id, stage, team_department_id, entry_date, qty, kg, defect_qty, defect_reason, machine_note, note, created_by, created_at'

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
      defect_reason: string | null
      machine_note: string | null
      note: string | null
      created_by: string
    }[],
  ): Promise<void> {
    const { error } = await db().from('production_output_entries').insert(rows)
    if (error) throw new Error(error.message)
  },

  /**
   * Sản lượng GỌN theo khoảng ngày — chart tuần CEO, KPI phế, SL hôm nay per
   * tổ (Tháp điều hành). Rows gọn + aggregate ở lib/service (exec-ops.ts) —
   * data dev nhỏ; nếu phình thì đổi ruột sang RPC, giữ nguyên chữ ký.
   */
  async listRange(
    fromDate: string,
    toDate: string,
  ): Promise<
    {
      production_order_id: string
      component_id: string
      stage: string
      team_department_id: string | null
      entry_date: string
      qty: number
      defect_qty: number
      defect_reason: string | null
    }[]
  > {
    const { data } = await db()
      .from('production_output_entries')
      .select(
        'production_order_id, component_id, stage, team_department_id, entry_date, qty, defect_qty, defect_reason',
      )
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .limit(20000)
    return (data ?? []) as {
      production_order_id: string
      component_id: string
      stage: string
      team_department_id: string | null
      entry_date: string
      qty: number
      defect_qty: number
      defect_reason: string | null
    }[]
  },

  /** Sổ toàn xưởng: mọi bản ghi của 1 NGÀY (mọi LSX), kèm tên chi tiết + mã LSX. */
  async listByDate(date: string): Promise<LogbookEntry[]> {
    const { data } = await db()
      .from('production_output_entries')
      .select(
        `${COLS}, team:departments(name), actor:users(name), component:production_order_components(name), lsx:production_orders(code)`,
      )
      .eq('entry_date', date)
      .order('created_at', { ascending: false })
      .limit(2000)
    type RawDay = Raw & {
      component: { name: string } | { name: string }[] | null
      lsx: { code: string } | { code: string }[] | null
    }
    return ((data ?? []) as unknown as RawDay[]).map((r) => {
      const base = unwrap([r])[0]
      const c = Array.isArray(r.component) ? r.component[0] : r.component
      const l = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
      return {
        ...base,
        component: undefined,
        lsx: undefined,
        component_name: c?.name ?? null,
        lsx_code: l?.code ?? null,
      } as unknown as LogbookEntry
    })
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
