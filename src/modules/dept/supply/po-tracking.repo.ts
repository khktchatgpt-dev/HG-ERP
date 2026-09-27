import { db } from '@/server/db'
import type { CommitKind, IssueKind } from '@/lib/po-tracking'

/**
 * SỔ HẸN GIAO + SỔ SỰ CỐ của đơn mua (0213). Hai sổ chỉ GHI THÊM — sự cố thì
 * cập nhật trạng thái đóng, không xoá.
 */
export type CommitLogRow = {
  id: string
  po_id: string
  shipment_id: string | null
  kind: CommitKind
  date_before: string | null
  date_after: string | null
  lines: { po_line_id: string; qty: number }[]
  reason: string | null
  created_by_name: string | null
  created_at: string
}

export type CommitLogInsert = {
  po_id: string
  shipment_id?: string | null
  kind: CommitKind
  date_before?: string | null
  date_after?: string | null
  lines?: { po_line_id: string; qty: number }[]
  reason?: string | null
  created_by: string
}

export type PoIssue = {
  id: string
  po_id: string
  po_line_id: string | null
  kind: IssueKind
  qty: number | null
  description: string
  status: 'mo' | 'da_xu_ly'
  resolution: string | null
  created_by_name: string | null
  created_at: string
  resolved_by_name: string | null
  resolved_at: string | null
}

type U = { name: string | null; email: string } | null
const who = (u: U) => (u ? u.name || u.email : null)

export const poTrackingRepo = {
  async logCommits(rows: CommitLogInsert[]): Promise<void> {
    if (rows.length === 0) return
    const { error } = await db()
      .from('supply_po_commit_log')
      .insert(rows.map((r) => ({ ...r, lines: r.lines ?? [] })))
    if (error) throw new Error(error.message)
  },

  async commitLog(poId: string): Promise<CommitLogRow[]> {
    const { data, error } = await db()
      .from('supply_po_commit_log')
      .select('*, creator:users!supply_po_commit_log_created_by_fkey(name, email)')
      .eq('po_id', poId)
      .order('created_at')
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as (CommitLogRow & { creator: U })[]).map(
      ({ creator, ...r }) => ({
        ...r,
        lines: (r.lines ?? []).map((l) => ({
          po_line_id: l.po_line_id,
          qty: Number(l.qty),
        })),
        created_by_name: who(creator),
      }),
    )
  },

  async insertIssue(row: {
    po_id: string
    po_line_id: string | null
    kind: IssueKind
    qty: number | null
    description: string
    created_by: string
  }): Promise<string> {
    const { data, error } = await db()
      .from('supply_po_issues')
      .insert(row)
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return (data as { id: string }).id
  },

  async findIssue(
    id: string,
  ): Promise<{ id: string; po_id: string; status: string } | null> {
    const { data, error } = await db()
      .from('supply_po_issues')
      .select('id, po_id, status')
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data as { id: string; po_id: string; status: string } | null
  },

  /** Đóng sự cố — chỉ khi đang mở (điều kiện ở WHERE: hai người bấm cùng lúc không ghi đè nhau). */
  async resolveIssue(id: string, userId: string, resolution: string): Promise<boolean> {
    const { data, error } = await db()
      .from('supply_po_issues')
      .update({
        status: 'da_xu_ly',
        resolution,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      }) // prettier-ignore
      .eq('id', id)
      .eq('status', 'mo')
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length > 0
  },

  async issues(poId: string): Promise<PoIssue[]> {
    const { data, error } = await db()
      .from('supply_po_issues')
      .select(
        '*, creator:users!supply_po_issues_created_by_fkey(name, email), resolver:users!supply_po_issues_resolved_by_fkey(name, email)',
      )
      .eq('po_id', poId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as (PoIssue & { creator: U; resolver: U })[]).map(
      ({ creator, resolver, ...r }) => ({
        ...r,
        qty: r.qty == null ? null : Number(r.qty),
        created_by_name: who(creator),
        resolved_by_name: who(resolver),
      }),
    )
  },
}
