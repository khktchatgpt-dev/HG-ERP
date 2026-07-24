import { db } from '@/server/db'

/**
 * production_entries (0084) — sổ số liệu APPEND-ONLY của thống kê xưởng:
 * 1 bản ghi = 1 lần báo sản lượng cho 1 chi tiết ở 1 công đoạn trong 1 ngày.
 * Ghi nhầm → xoá rồi nhập lại, không sửa đè. Đây là NGUỒN SỐ duy nhất —
 * trạng thái nằm ở production_jobs.
 */

export type ProductionEntry = {
  id: string
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
  created_by: string | null
  created_at: string
}

export type ProductionEntryJoined = ProductionEntry & {
  team_name: string | null
  created_by_name: string | null
  component_name: string | null
  component_cluster: string | null
  component_line_id: string | null
  lsx_code: string | null
}

const COLS =
  'id, production_order_id, component_id, stage, team_department_id, entry_date, qty, kg, defect_qty, defect_reason, machine_note, note, created_by, created_at'
const SELECT_JOINED = `${COLS}, team:departments(name), actor:users(name), component:production_components(name, cluster, order_line_id), lsx:production_orders(code)`

type One<T> = T | T[] | null
type Raw = ProductionEntry & {
  team: One<{ name: string }>
  actor: One<{ name: string | null }>
  component: One<{ name: string; cluster: string | null; order_line_id: string }>
  lsx: One<{ code: string }>
}

const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function unwrap(rows: Raw[] | null): ProductionEntryJoined[] {
  return (rows ?? []).map((r) => {
    const comp = first(r.component)
    return {
      ...r,
      team: undefined,
      actor: undefined,
      component: undefined,
      lsx: undefined,
      qty: Number(r.qty),
      kg: r.kg == null ? null : Number(r.kg),
      defect_qty: Number(r.defect_qty),
      team_name: first(r.team)?.name ?? null,
      created_by_name: first(r.actor)?.name ?? null,
      component_name: comp?.name ?? null,
      component_cluster: comp?.cluster ?? null,
      component_line_id: comp?.order_line_id ?? null,
      lsx_code: first(r.lsx)?.code ?? null,
    } as unknown as ProductionEntryJoined
  })
}

export const entriesRepo = {
  async findById(id: string): Promise<ProductionEntry | null> {
    const { data } = await db()
      .from('production_entries')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as ProductionEntry | null) ?? null
  },

  async listByLsx(productionOrderId: string): Promise<ProductionEntry[]> {
    const { data } = await db()
      .from('production_entries')
      .select(COLS)
      .eq('production_order_id', productionOrderId)
      .order('created_at', { ascending: true })
      .limit(20000)
    return ((data ?? []) as ProductionEntry[]).map((r) => ({
      ...r,
      qty: Number(r.qty),
      kg: r.kg == null ? null : Number(r.kg),
      defect_qty: Number(r.defect_qty),
    }))
  },

  /** Sổ của NHIỀU lệnh — bảng tổng/báo cáo, tránh N query. */
  async listByLsxBulk(ids: string[]): Promise<ProductionEntry[]> {
    if (!ids.length) return []
    const { data } = await db()
      .from('production_entries')
      .select(COLS)
      .in('production_order_id', ids)
      .limit(50000)
    return ((data ?? []) as ProductionEntry[]).map((r) => ({
      ...r,
      qty: Number(r.qty),
      kg: r.kg == null ? null : Number(r.kg),
      defect_qty: Number(r.defect_qty),
    }))
  },

  /** Sổ trong khoảng ngày [from, to] — báo cáo tuần/chất lượng khu GĐ. */
  async listRange(fromDate: string, toDate: string): Promise<ProductionEntry[]> {
    const { data } = await db()
      .from('production_entries')
      .select(COLS)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .limit(50000)
    return ((data ?? []) as ProductionEntry[]).map((r) => ({
      ...r,
      qty: Number(r.qty),
      kg: r.kg == null ? null : Number(r.kg),
      defect_qty: Number(r.defect_qty),
    }))
  },

  /** Sổ GẦN ĐÂY của 1 TỔ (từ ngày `since`) — màn tổ trưởng xem quá trình tổ mình. */
  async listRecentByTeam(
    teamDepartmentId: string,
    sinceDate: string,
  ): Promise<ProductionEntryJoined[]> {
    const { data } = await db()
      .from('production_entries')
      .select(SELECT_JOINED)
      .eq('team_department_id', teamDepartmentId)
      .gte('entry_date', sinceDate)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Sổ toàn xưởng 1 ngày (kèm tên tổ/người/chi tiết/lệnh) — màn logbook. */
  async listByDate(date: string): Promise<ProductionEntryJoined[]> {
    const { data } = await db()
      .from('production_entries')
      .select(SELECT_JOINED)
      .eq('entry_date', date)
      .order('created_at', { ascending: false })
      .limit(2000)
    return unwrap(data as unknown as Raw[] | null)
  },

  async insertMany(rows: Omit<ProductionEntry, 'id' | 'created_at'>[]): Promise<void> {
    if (!rows.length) return
    const { error } = await db().from('production_entries').insert(rows)
    if (error) throw new Error(error.message)
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('production_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** LSX đã có sổ chưa — khoá ghi đè bảng chi tiết (components.service). */
  async existsForLsx(productionOrderId: string): Promise<boolean> {
    const { data } = await db()
      .from('production_entries')
      .select('id')
      .eq('production_order_id', productionOrderId)
      .limit(1)
    return !!data?.length
  },
}
