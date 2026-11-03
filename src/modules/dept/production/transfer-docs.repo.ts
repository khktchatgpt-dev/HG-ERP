import { db } from '@/server/db'
import type { Transfer } from './transfers.repo'

/**
 * Header PHIẾU GIAO TỔ (0289). Dòng phiếu nằm ở `production_transfers`
 * (transfersRepo) với `doc_id` — repo này chỉ thêm các thao tác theo phiếu.
 */

export type TransferDocStatus = 'da_giao' | 'da_nhan' | 'da_huy'

export type TransferDoc = {
  id: string
  doc_no: string
  production_order_id: string
  from_stage: string
  from_team_id: string | null
  to_stage: string
  to_team_id: string | null
  entry_date: string
  status: TransferDocStatus
  note: string | null
  cancel_reason: string | null
  /** Phiếu ĐẢO của phiếu nào (from/to đã hoán đổi). */
  reverses_doc_id: string | null
  created_by: string | null
  created_at: string
  received_by: string | null
  received_at: string | null
}

const COLS =
  'id, doc_no, production_order_id, from_stage, from_team_id, to_stage, to_team_id, entry_date, status, note, cancel_reason, reverses_doc_id, created_by, created_at, received_by, received_at'

const LINE_COLS =
  'id, production_order_id, component_id, stage, team_department_id, direction, entry_date, qty, reason, note, created_by, created_at, doc_id, received_qty, diff_reason'

const numLine = (r: Transfer): Transfer => ({
  ...r,
  qty: Number(r.qty),
  received_qty: r.received_qty == null ? null : Number(r.received_qty),
})

export const transferDocsRepo = {
  async nextDocNo(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'PGT' })
    if (error) throw new Error(error.message)
    return data as string
  },

  async findById(id: string): Promise<TransferDoc | null> {
    const { data } = await db()
      .from('production_transfer_docs')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as TransferDoc | null) ?? null
  },

  async listByLsxBulk(ids: string[]): Promise<TransferDoc[]> {
    if (!ids.length) return []
    const { data } = await db()
      .from('production_transfer_docs')
      .select(COLS)
      .in('production_order_id', ids)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000)
    return (data ?? []) as TransferDoc[]
  },

  async insert(
    row: Omit<
      TransferDoc,
      'id' | 'created_at' | 'status' | 'cancel_reason' | 'received_by' | 'received_at'
    > &
      Partial<Pick<TransferDoc, 'status' | 'received_by' | 'received_at'>>,
  ): Promise<TransferDoc> {
    const { data, error } = await db()
      .from('production_transfer_docs')
      .insert(row)
      .select(COLS)
      .single()
    if (error) throw new Error(error.message)
    return data as TransferDoc
  },

  async patch(
    id: string,
    patch: Partial<
      Pick<TransferDoc, 'status' | 'cancel_reason' | 'received_by' | 'received_at'>
    >,
  ): Promise<void> {
    const { error } = await db()
      .from('production_transfer_docs')
      .update(patch)
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Dòng của một phiếu. */
  async listLines(docId: string): Promise<Transfer[]> {
    const { data } = await db()
      .from('production_transfers')
      .select(LINE_COLS)
      .eq('doc_id', docId)
      .order('created_at')
    return ((data ?? []) as Transfer[]).map(numLine)
  },

  async insertLines(rows: Omit<Transfer, 'id' | 'created_at'>[]): Promise<void> {
    if (!rows.length) return
    const { error } = await db().from('production_transfers').insert(rows)
    if (error) throw new Error(error.message)
  },

  async setReceived(
    id: string,
    receivedQty: number,
    diffReason: string | null,
  ): Promise<void> {
    const { error } = await db()
      .from('production_transfers')
      .update({ received_qty: receivedQty, diff_reason: diffReason })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
