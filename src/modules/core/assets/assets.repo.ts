import { db } from '@/server/db'
import type {
  AssetKind,
  AssetStatus,
  IssuePriority,
  IssueStatus,
  MoveType,
  Part,
  PlanUnit,
  WoKind,
} from '@/lib/may-moc'

/** Truy cập dữ liệu khu Máy móc (0270). Lỗi đọc được NÉM, không nuốt thành rỗng. */

/**
 * Id từ URL không phải uuid (vd. `/plans/abc/done`) thì Postgres ném "invalid input
 * syntax for type uuid" → route trả 500. Coi như không tìm thấy để service trả 404.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type GroupTemplate = {
  task: string
  every: number
  unit: PlanUnit
  cost?: number
  inspection?: boolean
}
export type GroupRow = {
  id: string
  name: string
  kind: AssetKind
  life_months: number
  templates: GroupTemplate[]
  sort_order: number
  active: boolean
}

export type AssetRow = {
  id: string
  code: string
  name: string
  group_id: string
  kind: AssetKind
  model: string | null
  serial: string | null
  supplier: string | null
  purchase_date: string | null
  use_date: string | null
  cost: number
  qty: number
  unit: string
  department_id: string | null
  resp_employee_id: string | null
  holder_employee_id: string | null
  status: AssetStatus
  hours_per_day: number
  hours: number
  hours_updated_on: string | null
  disposed_on: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type PlanRow = {
  id: string
  asset_id: string
  task: string
  every_n: number
  unit: PlanUnit
  cost: number
  is_inspection: boolean
  last_date: string
  last_hours: number | null
  active: boolean
}

export type IssueLog = { at: string; by: string | null; name: string; text: string }
export type IssueRow = {
  id: string
  no: string
  asset_id: string
  reporter_user_id: string | null
  reported_at: string
  description: string
  priority: IssuePriority
  status: IssueStatus
  tech_employee_id: string | null
  vendor: string | null
  estimate: number | null
  started_on: string | null
  prev_asset_status: AssetStatus | null
  cancel_reason: string | null
  file_ids: string[]
  log: IssueLog[]
  work_order_id: string | null
  created_at: string
  updated_at: string
}

export type WorkOrderRow = {
  id: string
  no: string
  kind: WoKind
  asset_id: string
  plan_id: string | null
  issue_id: string | null
  title: string
  done_on: string
  tech_employee_id: string | null
  vendor: string | null
  parts: Part[]
  labor: number
  cost: number
  downtime_hours: number
  hours_reading: number | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type MovementRow = {
  id: string
  no: string
  type: MoveType
  moved_on: string
  asset_ids: string[]
  from_department_id: string | null
  to_department_id: string | null
  from_employee_id: string | null
  to_employee_id: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type EmployeeLite = {
  id: string
  code: string
  full_name: string
  team: string | null
  job_title: string | null
  active: boolean
  leave_date: string | null
}

const NUM_ASSET = ['cost', 'qty', 'hours_per_day', 'hours'] as const
const numify = <T extends Record<string, unknown>>(r: T, keys: readonly string[]): T => {
  const o: Record<string, unknown> = { ...r }
  for (const k of keys) if (o[k] != null) o[k] = Number(o[k])
  return o as T
}
const asAsset = (r: Record<string, unknown>) =>
  numify(r, NUM_ASSET) as unknown as AssetRow
const asPlan = (r: Record<string, unknown>) =>
  numify(r, ['every_n', 'cost', 'last_hours']) as unknown as PlanRow
const asIssue = (r: Record<string, unknown>) =>
  numify(r, ['estimate']) as unknown as IssueRow
const asWo = (r: Record<string, unknown>) =>
  numify(r, [
    'labor',
    'cost',
    'downtime_hours',
    'hours_reading',
  ]) as unknown as WorkOrderRow

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`${what}: ${error?.message ?? 'không có dữ liệu'}`)
}

export const assetsRepo = {
  // ── Nhóm ─────────────────────────────────────────────────────────────────
  async groups(): Promise<GroupRow[]> {
    const { data, error } = await db()
      .from('asset_groups')
      .select('*')
      .order('sort_order')
    if (error) fail('asset groups', error)
    return (data ?? []) as unknown as GroupRow[]
  },

  // ── Máy / dụng cụ ────────────────────────────────────────────────────────
  async listAssets(): Promise<AssetRow[]> {
    const { data, error } = await db()
      .from('assets')
      .select('*')
      .order('code')
      .limit(5000)
    if (error) fail('assets list', error)
    return (data ?? []).map((r) => asAsset(r as Record<string, unknown>))
  },
  async findAsset(id: string): Promise<AssetRow | null> {
    if (!UUID.test(id)) return null
    const { data, error } = await db()
      .from('assets')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) fail('asset', error)
    return data ? asAsset(data as Record<string, unknown>) : null
  },
  async findAssetByCode(code: string): Promise<AssetRow | null> {
    const { data, error } = await db()
      .from('assets')
      .select('*')
      .eq('code', code)
      .maybeSingle()
    if (error) fail('asset by code', error)
    return data ? asAsset(data as Record<string, unknown>) : null
  },
  async findAssets(ids: string[]): Promise<AssetRow[]> {
    if (ids.length === 0) return []
    const { data, error } = await db().from('assets').select('*').in('id', ids)
    if (error) fail('assets by ids', error)
    return (data ?? []).map((r) => asAsset(r as Record<string, unknown>))
  },
  async insertAsset(
    row: Partial<AssetRow> & Pick<AssetRow, 'code' | 'name' | 'group_id' | 'kind'>,
  ) {
    const { data, error } = await db().from('assets').insert(row).select('*').single()
    if (error || !data) fail('asset insert', error)
    return asAsset(data as Record<string, unknown>)
  },
  async updateAsset(id: string, patch: Partial<AssetRow>): Promise<AssetRow> {
    const { data, error } = await db()
      .from('assets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) fail('asset update', error)
    return asAsset(data as Record<string, unknown>)
  },
  async updateAssets(ids: string[], patch: Partial<AssetRow>): Promise<void> {
    if (ids.length === 0) return
    const { error } = await db().from('assets').update(patch).in('id', ids)
    if (error) fail('assets update', error)
  },

  /** Tăng bộ đếm nguyên tử (asset_next_no) — trả số mới. */
  async nextNo(key: string): Promise<number> {
    const { data, error } = await db().rpc('asset_next_no', { p_key: key })
    if (error || data == null) fail('asset counter', error)
    return Number(data)
  },

  // ── Lịch bảo trì ─────────────────────────────────────────────────────────
  async listPlans(assetIds?: string[]): Promise<PlanRow[]> {
    let q = db().from('asset_plans').select('*').order('created_at')
    if (assetIds) {
      if (assetIds.length === 0) return []
      q = q.in('asset_id', assetIds)
    }
    const { data, error } = await q.limit(20000)
    if (error) fail('asset plans', error)
    return (data ?? []).map((r) => asPlan(r as Record<string, unknown>))
  },
  async findPlan(id: string): Promise<PlanRow | null> {
    if (!UUID.test(id)) return null
    const { data, error } = await db()
      .from('asset_plans')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) fail('asset plan', error)
    return data ? asPlan(data as Record<string, unknown>) : null
  },
  async insertPlans(rows: Omit<PlanRow, 'id' | 'active'>[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await db().from('asset_plans').insert(rows)
    if (error) fail('asset plans insert', error)
  },
  async updatePlan(id: string, patch: Partial<PlanRow>): Promise<PlanRow> {
    const { data, error } = await db()
      .from('asset_plans')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error || !data) fail('asset plan update', error)
    return asPlan(data as Record<string, unknown>)
  },

  // ── Phiếu đã làm ─────────────────────────────────────────────────────────
  async listWorkOrders(
    f: { assetId?: string; from?: string; to?: string } = {},
  ): Promise<WorkOrderRow[]> {
    let q = db()
      .from('asset_work_orders')
      .select('*')
      .order('done_on', { ascending: false })
      .order('no', { ascending: false })
    if (f.assetId) q = q.eq('asset_id', f.assetId)
    if (f.from) q = q.gte('done_on', f.from)
    if (f.to) q = q.lt('done_on', f.to)
    const { data, error } = await q.limit(20000)
    if (error) fail('work orders', error)
    return (data ?? []).map((r) => asWo(r as Record<string, unknown>))
  },
  async insertWorkOrder(
    row: Omit<WorkOrderRow, 'id' | 'created_at'>,
  ): Promise<WorkOrderRow> {
    const { data, error } = await db()
      .from('asset_work_orders')
      .insert(row)
      .select('*')
      .single()
    if (error || !data) fail('work order insert', error)
    return asWo(data as Record<string, unknown>)
  },

  // ── Báo hỏng ─────────────────────────────────────────────────────────────
  async listIssues(f: { assetId?: string; since?: string } = {}): Promise<IssueRow[]> {
    let q = db()
      .from('asset_issues')
      .select('*')
      .order('reported_at', { ascending: false })
    if (f.assetId) q = q.eq('asset_id', f.assetId)
    if (f.since) q = q.or(`status.in.(moi,cho_duyet,dang_sua),reported_at.gte.${f.since}`)
    const { data, error } = await q.limit(5000)
    if (error) fail('issues', error)
    return (data ?? []).map((r) => asIssue(r as Record<string, unknown>))
  },
  async findIssue(id: string): Promise<IssueRow | null> {
    if (!UUID.test(id)) return null
    const { data, error } = await db()
      .from('asset_issues')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) fail('issue', error)
    return data ? asIssue(data as Record<string, unknown>) : null
  },
  async openIssueOf(assetId: string): Promise<IssueRow | null> {
    const { data, error } = await db()
      .from('asset_issues')
      .select('*')
      .eq('asset_id', assetId)
      .in('status', ['moi', 'cho_duyet', 'dang_sua'])
      .maybeSingle()
    if (error) fail('open issue', error)
    return data ? asIssue(data as Record<string, unknown>) : null
  },
  async insertIssue(
    row: Partial<IssueRow> &
      Pick<IssueRow, 'no' | 'asset_id' | 'description' | 'priority'>,
  ) {
    const { data, error } = await db()
      .from('asset_issues')
      .insert(row)
      .select('*')
      .single()
    if (error || !data) fail('issue insert', error)
    return asIssue(data as Record<string, unknown>)
  },
  /** Cập nhật CÓ ĐIỀU KIỆN trạng thái cũ — hai người bấm cùng lúc thì người sau nhận lỗi, không ghi đè. */
  async updateIssue(
    id: string,
    from: string[],
    patch: Partial<IssueRow>,
  ): Promise<IssueRow | null> {
    const { data, error } = await db()
      .from('asset_issues')
      .update(patch)
      .eq('id', id)
      .in('status', from)
      .select('*')
      .maybeSingle()
    if (error) fail('issue update', error)
    return data ? asIssue(data as Record<string, unknown>) : null
  },

  // ── Giao nhận ────────────────────────────────────────────────────────────
  async listMovements(assetId?: string): Promise<MovementRow[]> {
    let q = db()
      .from('asset_movements')
      .select('*')
      .order('moved_on', { ascending: false })
      .order('no', { ascending: false })
    if (assetId) q = q.contains('asset_ids', [assetId])
    const { data, error } = await q.limit(5000)
    if (error) fail('movements', error)
    return (data ?? []) as unknown as MovementRow[]
  },
  async insertMovement(
    row: Omit<MovementRow, 'id' | 'created_at'>,
  ): Promise<MovementRow> {
    const { data, error } = await db()
      .from('asset_movements')
      .insert(row)
      .select('*')
      .single()
    if (error || !data) fail('movement insert', error)
    return data as unknown as MovementRow
  },

  /**
   * Nhận ảnh hiện trạng (tải lên trước khi phiếu tồn tại, parent `none`) về
   * phiếu báo hỏng. Chỉ file của CHÍNH người báo, đã finalize, chưa thuộc phiếu nào.
   */
  async claimFiles(ids: string[], issueId: string, ownerId: string): Promise<string[]> {
    if (ids.length === 0) return []
    const { data, error } = await db()
      .from('files')
      .update({ asset_issue_id: issueId })
      .in('id', ids)
      .eq('owner_id', ownerId)
      .is('asset_issue_id', null)
      .is('deleted_at', null)
      .not('finalized_at', 'is', null)
      .select('id')
    if (error) fail('claim files', error)
    const ok = new Set((data ?? []).map((r: { id: string }) => r.id))
    return ids.filter((id) => ok.has(id))
  },

  // ── Người, hạn mức ───────────────────────────────────────────────────────
  async employees(): Promise<EmployeeLite[]> {
    const { data, error } = await db()
      .from('hr_employees')
      .select('id, code, full_name, team, job_title, active, leave_date')
      .order('full_name')
      .limit(5000)
    if (error) fail('employees', error)
    return (data ?? []) as EmployeeLite[]
  },
  async approveOver(): Promise<number> {
    const { data, error } = await db()
      .from('settings')
      .select('value')
      .eq('key', 'asset_approve_over')
      .maybeSingle()
    if (error) fail('approve threshold', error)
    const v = Number((data as { value: unknown } | null)?.value)
    return Number.isFinite(v) && v > 0 ? v : 10_000_000
  },
}
