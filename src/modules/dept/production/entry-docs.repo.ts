import { db } from '@/server/db'

/**
 * production_entry_docs (0172) — header PHIẾU BÁO SẢN LƯỢNG (PBS): 1 phiếu =
 * 1 lượt Ghi sổ (lệnh × công đoạn × tổ × ngày); dòng phiếu là
 * production_entries.doc_id. Số phiếu cấp qua next_doc_code('PBS') (0164).
 */

/**
 * Trạng thái phiếu (0176) — luồng xác nhận của tổ trưởng:
 *   nhap → cho_xac_nhan → da_xac_nhan; nhánh lỗi → tu_choi → (sửa) → gửi lại.
 * 'tu_choi' gộp luôn "cần điều chỉnh": cùng nghĩa phiếu bị trả về cho thống kê.
 * Luật CHUYỂN trạng thái nằm ở service (Bước 4), không phải ở repo.
 */
export type EntryDocStatus = 'nhap' | 'cho_xac_nhan' | 'da_xac_nhan' | 'tu_choi'

export type EntryDoc = {
  id: string
  doc_no: string
  production_order_id: string
  stage: string
  team_department_id: string | null
  entry_date: string
  status: EntryDocStatus
  /** Tổ trưởng đã xác nhận (bắt buộc khi status = 'da_xac_nhan' — check DB). */
  confirmed_by: string | null
  confirmed_at: string | null
  /** Lý do trả phiếu về (bắt buộc khi status = 'tu_choi' — check DB). */
  reject_reason: string | null
  note: string | null
  created_by: string | null
  created_at: string
}

export type EntryDocJoined = EntryDoc & {
  team_name: string | null
  created_by_name: string | null
  lsx_code: string | null
}

const COLS =
  'id, doc_no, production_order_id, stage, team_department_id, entry_date, status, confirmed_by, confirmed_at, reject_reason, note, created_by, created_at'
const SELECT_JOINED = `${COLS}, team:departments(name), actor:users(name), lsx:production_orders(code)`

type One<T> = T | T[] | null
type Raw = EntryDoc & {
  team: One<{ name: string }>
  actor: One<{ name: string | null }>
  lsx: One<{ code: string }>
}

const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

function unwrap(rows: Raw[] | null): EntryDocJoined[] {
  return (rows ?? []).map(
    (r) =>
      ({
        ...r,
        team: undefined,
        actor: undefined,
        lsx: undefined,
        team_name: first(r.team)?.name ?? null,
        created_by_name: first(r.actor)?.name ?? null,
        lsx_code: first(r.lsx)?.code ?? null,
      }) as unknown as EntryDocJoined,
  )
}

export const entryDocsRepo = {
  /** Cấp SỐ PHIẾU qua bộ đếm chứng từ chung (0164) — 'PBS-2026-0001'. */
  async nextDocNo(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'PBS' })
    if (error) throw new Error(error.message)
    return data as string
  },

  /**
   * Tạo phiếu. Bốn trường của luồng xác nhận (0176) để TUỲ CHỌN vì DB đã có
   * mặc định `status = 'nhap'` và ba trường kia chỉ điền khi tổ trưởng thao
   * tác — caller không phải khai lại thứ nó chưa biết.
   */
  async insert(
    row: Omit<
      EntryDoc,
      'id' | 'created_at' | 'status' | 'confirmed_by' | 'confirmed_at' | 'reject_reason'
    > &
      Partial<Pick<EntryDoc, 'status'>>,
  ): Promise<EntryDoc> {
    const { data, error } = await db()
      .from('production_entry_docs')
      .insert(row)
      .select(COLS)
      .single()
    if (error) throw new Error(error.message)
    return data as EntryDoc
  },

  async findById(id: string): Promise<EntryDocJoined | null> {
    const { data } = await db()
      .from('production_entry_docs')
      .select(SELECT_JOINED)
      .eq('id', id)
      .maybeSingle()
    return data ? unwrap([data as unknown as Raw])[0] : null
  },

  /** Phiếu của MỘT ngày (mọi lệnh) — sổ đã ghi nhóm theo phiếu. */
  async listByDate(date: string): Promise<EntryDocJoined[]> {
    const { data } = await db()
      .from('production_entry_docs')
      .select(SELECT_JOINED)
      .eq('entry_date', date)
      .order('created_at', { ascending: false })
      .limit(1000)
    return unwrap(data as unknown as Raw[] | null)
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('production_entry_docs').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
