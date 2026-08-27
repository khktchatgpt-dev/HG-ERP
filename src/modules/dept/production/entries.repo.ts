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
  /** Phiếu báo sản lượng chứa dòng này (0172) — null = bản ghi lẻ trước PBS. */
  doc_id: string | null
  entry_date: string
  qty: number
  kg: number | null
  defect_qty: number
  defect_reason: string | null
  machine_note: string | null
  /** "Người làm" trực tiếp (0090) — text tự do như sổ giấy. */
  worker_name: string | null
  /** 'tran' (hàng trần) | 'dang_may' (hàng đang mây) — 0090. */
  finish_state: string | null
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
  'id, production_order_id, component_id, stage, team_department_id, doc_id, entry_date, qty, kg, defect_qty, defect_reason, machine_note, worker_name, finish_state, note, created_by, created_at'
const SELECT_JOINED = `${COLS}, team:departments(name), actor:users(name), component:production_components(name, cluster, production_order_line_id), lsx:production_orders(code)`

type One<T> = T | T[] | null
type Raw = ProductionEntry & {
  team: One<{ name: string }>
  actor: One<{ name: string | null }>
  component: One<{
    name: string
    cluster: string | null
    production_order_line_id: string | null
  }>
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
      component_line_id: comp?.production_order_line_id ?? null,
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

  /**
   * Sổ của một lệnh KÈM trạng thái phiếu (0176) — để tách "đã xác nhận" (số
   * chính thức) khỏi "chờ duyệt" (tạm tính) theo luật Bước 3. Dòng lẻ không có
   * phiếu (`doc_id` null, bản ghi trước 0172) coi như đã xác nhận: chúng có từ
   * thời chưa có luồng duyệt, loại bỏ là mất số liệu lịch sử.
   */
  async listByLsxWithStatus(
    productionOrderId: string,
  ): Promise<(ProductionEntry & { doc_status: string })[]> {
    const { data } = await db()
      .from('production_entries')
      .select(`${COLS}, doc:production_entry_docs(status)`)
      .eq('production_order_id', productionOrderId)
      .limit(20000)
    type Row = ProductionEntry & {
      doc: { status: string } | { status: string }[] | null
    }
    return ((data ?? []) as unknown as Row[]).map((r) => {
      const doc = Array.isArray(r.doc) ? r.doc[0] : r.doc
      return {
        ...r,
        doc: undefined,
        qty: Number(r.qty),
        kg: r.kg == null ? null : Number(r.kg),
        defect_qty: Number(r.defect_qty),
        doc_status: doc?.status ?? 'da_xac_nhan',
      } as unknown as ProductionEntry & { doc_status: string }
    })
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

  /** Cặp (ngày × tổ) CÓ bản ghi trong khoảng — nhắc "ngày cũ chưa chốt sổ". */
  async listDayTeamPairs(
    fromDate: string,
    toDate: string,
  ): Promise<
    { entry_date: string; team_department_id: string; team_name: string | null }[]
  > {
    const { data } = await db()
      .from('production_entries')
      .select('entry_date, team_department_id, team:departments(name)')
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .not('team_department_id', 'is', null)
      .limit(20000)
    const rows = (data ?? []) as unknown as {
      entry_date: string
      team_department_id: string
      team: One<{ name: string }>
    }[]
    const seen = new Map<
      string,
      { entry_date: string; team_department_id: string; team_name: string | null }
    >()
    for (const r of rows) {
      const k = `${r.entry_date}|${r.team_department_id}`
      if (!seen.has(k)) {
        seen.set(k, {
          entry_date: r.entry_date,
          team_department_id: r.team_department_id,
          team_name: first(r.team)?.name ?? null,
        })
      }
    }
    return [...seen.values()]
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

  /** Dòng của MỘT phiếu (0172) — trang in PBS. */
  async listByDoc(docId: string): Promise<ProductionEntryJoined[]> {
    const { data } = await db()
      .from('production_entries')
      .select(SELECT_JOINED)
      .eq('doc_id', docId)
      .order('created_at', { ascending: true })
      .limit(500)
    return unwrap(data as unknown as Raw[] | null)
  },

  /** Xoá NGUYÊN PHIẾU (0172) — mọi dòng thuộc doc_id, trước khi xoá header. */
  async deleteByDoc(docId: string): Promise<void> {
    const { error } = await db().from('production_entries').delete().eq('doc_id', docId)
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
