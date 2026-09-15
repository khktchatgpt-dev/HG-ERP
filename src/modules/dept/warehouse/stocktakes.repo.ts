import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'

/**
 * ĐỢT KIỂM KÊ (0199) — tách khỏi `stock.repo.ts` vì đó đã hơn 1.000 dòng và
 * đợt là một chứng từ riêng, không phải một góc của phiếu kho.
 */

export type StocktakeScopeKind = 'bin' | 'group' | 'list'
export type StocktakeStatus = 'open' | 'counting' | 'review' | 'approved' | 'cancelled'

export type StocktakeScope =
  | { kind: 'bin'; bin_ids: string[] }
  | { kind: 'group'; groups: string[] }
  | { kind: 'list'; material_ids: string[] }

export type Stocktake = {
  id: string
  code: string
  scope_kind: StocktakeScopeKind
  scope_ref: Record<string, unknown>
  scope_count: number
  /** Mốc chốt sổ. Null = chưa mở đếm. */
  freeze_at: string | null
  blind_count: boolean
  status: StocktakeStatus
  assigned_to: string | null
  assigned_to_name: string | null
  doc_id: string | null
  doc_code: string | null
  note: string | null
  reject_reason: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string
  created_by_name: string | null
  created_at: string
}

export type TakeLine = {
  id: string
  material_id: string
  material_code: string | null
  material_name: string | null
  material_unit: string | null
  /** Tồn sổ TẠI freeze_at. Null = đợt chưa chốt sổ. */
  book_qty_frozen: number | null
  /** Null = CHƯA ĐẾM (khác hẳn đếm được 0). */
  counted_qty: number | null
  counted_by: string | null
  counted_at: string | null
  note: string | null
}

const COLS =
  'id, code, scope_kind, scope_ref, scope_count, freeze_at, blind_count, status, assigned_to, doc_id, note, reject_reason, approved_by, approved_at, created_by, created_at'
/*
 * Hai FK sang users (created_by + assigned_to) — embed `users(name)` trần là
 * mơ hồ và PostgREST trả lỗi. Hint đích danh, cùng lối với `warehouse_docs`.
 */
const JOINS =
  'actor:users!warehouse_stocktakes_created_by_fkey(name), counter:users!warehouse_stocktakes_assigned_to_fkey(name), doc:warehouse_docs(code)'

function num(v: unknown): number {
  return Number(v ?? 0)
}

function one(v: unknown): Record<string, unknown> | null {
  const x = Array.isArray(v) ? v[0] : v
  return (x as Record<string, unknown> | null) ?? null
}

function toTake(r: Record<string, unknown>): Stocktake {
  const actor = one(r.actor)
  const counter = one(r.counter)
  const doc = one(r.doc)
  return {
    id: r.id as string,
    code: r.code as string,
    scope_kind: r.scope_kind as StocktakeScopeKind,
    scope_ref: (r.scope_ref as Record<string, unknown> | null) ?? {},
    scope_count: num(r.scope_count),
    freeze_at: (r.freeze_at as string | null) ?? null,
    blind_count: Boolean(r.blind_count),
    status: r.status as StocktakeStatus,
    assigned_to: (r.assigned_to as string | null) ?? null,
    assigned_to_name: (counter?.name as string | null) ?? null,
    doc_id: (r.doc_id as string | null) ?? null,
    doc_code: (doc?.code as string | null) ?? null,
    note: (r.note as string | null) ?? null,
    reject_reason: (r.reject_reason as string | null) ?? null,
    approved_by: (r.approved_by as string | null) ?? null,
    approved_at: (r.approved_at as string | null) ?? null,
    created_by: r.created_by as string,
    created_by_name: (actor?.name as string | null) ?? null,
    created_at: r.created_at as string,
  }
}

export const stocktakesRepo = {
  async insert(row: {
    code: string
    scope_kind: StocktakeScopeKind
    /*
     * Json chứ không Record<string, unknown>: kiểu sinh từ DB cho cột jsonb
     * là Json, và Record không gán được vào nó (Json cho phép cả mảng).
     */
    scope_ref: Json
    scope_count: number
    blind_count: boolean
    assigned_to: string | null
    note: string | null
    created_by: string
  }): Promise<{ id: string; code: string }> {
    const { data, error } = await db()
      .from('warehouse_stocktakes')
      .insert(row)
      .select('id, code')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert stocktake failed')
    return data as { id: string; code: string }
  },

  async patch(
    id: string,
    patch: Partial<{
      status: StocktakeStatus
      freeze_at: string
      doc_id: string
      reject_reason: string | null
      approved_by: string
      approved_at: string
      assigned_to: string | null
      blind_count: boolean
      note: string | null
    }>,
  ): Promise<void> {
    const { error } = await db().from('warehouse_stocktakes').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async findById(id: string): Promise<Stocktake | null> {
    const { data } = await db()
      .from('warehouse_stocktakes')
      .select(`${COLS}, ${JOINS}`)
      .eq('id', id)
      .maybeSingle()
    return data ? toTake(data as Record<string, unknown>) : null
  },

  async list(filter: {
    status?: StocktakeStatus
    page: number
    page_size: number
  }): Promise<{ rows: Stocktake[]; total: number }> {
    let q = db()
      .from('warehouse_stocktakes')
      .select(`${COLS}, ${JOINS}`, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.status) q = q.eq('status', filter.status)
    const from = (filter.page - 1) * filter.page_size
    const { data, count } = await q.range(from, from + filter.page_size - 1)
    return {
      rows: ((data as Record<string, unknown>[] | null) ?? []).map(toTake),
      total: count ?? 0,
    }
  },

  /** Đếm đợt đang mở / đang đếm / chờ đối chiếu — nuôi badge và ô việc. */
  async countOpen(): Promise<number> {
    const { count } = await db()
      .from('warehouse_stocktakes')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'counting', 'review'])
    return count ?? 0
  },

  async insertLines(
    rows: {
      stocktake_id: string
      material_id: string
      system_qty: number
      book_qty_frozen: number
    }[],
  ): Promise<void> {
    if (rows.length === 0) return
    // Chèn theo lô 500: phạm vi có thể là cả một nhóm vài nghìn mã, và một
    // insert khổng lồ vừa chạm trần payload vừa khoá bảng lâu.
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db()
        .from('warehouse_stocktake_lines')
        .insert(rows.slice(i, i + 500))
      if (error) throw new Error(error.message)
    }
  },

  async listLines(stocktakeId: string): Promise<TakeLine[]> {
    const out: TakeLine[] = []
    // Phân trang: phạm vi một nhóm vật tư có thể vượt trần 1000 dòng của
    // PostgREST, và lúc đó nó cắt đuôi IM LẶNG — đúng bẫy đã cắn hai lần.
    for (let from = 0; ; from += 1000) {
      const { data } = await db()
        .from('warehouse_stocktake_lines')
        .select(
          'id, material_id, book_qty_frozen, counted_qty, counted_by, counted_at, note, material:warehouse_materials(code, name, unit)',
        )
        .eq('stocktake_id', stocktakeId)
        .order('material_id')
        .range(from, from + 999)
      const rows = (data as Record<string, unknown>[] | null) ?? []
      for (const r of rows) {
        const mat = (one(r.material) ?? {}) as {
          code?: string
          name?: string
          unit?: string
        }
        out.push({
          id: r.id as string,
          material_id: r.material_id as string,
          material_code: mat.code ?? null,
          material_name: mat.name ?? null,
          material_unit: mat.unit ?? null,
          book_qty_frozen: r.book_qty_frozen == null ? null : Number(r.book_qty_frozen),
          // KHÔNG dùng num(): nó biến null thành 0, và "chưa đếm" sẽ thành
          // "đếm được 0" — mất đúng thông tin đợt này cần nhất.
          counted_qty: r.counted_qty == null ? null : Number(r.counted_qty),
          counted_by: (r.counted_by as string | null) ?? null,
          counted_at: (r.counted_at as string | null) ?? null,
          note: (r.note as string | null) ?? null,
        })
      }
      if (rows.length < 1000) break
    }
    return out
  },

  /** Ghi số đếm cho một dòng. `diff` tính lại ở service, không tin client. */
  async patchLine(
    id: string,
    patch: {
      counted_qty: number
      diff: number
      counted_by: string
      note?: string | null
    },
  ): Promise<void> {
    const { error } = await db()
      .from('warehouse_stocktake_lines')
      .update({ ...patch, counted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Gắn dòng của đợt vào phiếu KK vừa sinh lúc duyệt. */
  async attachDoc(stocktakeId: string, docId: string): Promise<void> {
    const { error } = await db()
      .from('warehouse_stocktake_lines')
      .update({ doc_id: docId })
      .eq('stocktake_id', stocktakeId)
    if (error) throw new Error(error.message)
  },
}

/**
 * Tồn SỔ tại một mốc (RPC 0200). Mã không có dòng nào trước mốc thì RPC không
 * trả về — người gọi coi thiếu = 0, và đó là câu trả lời đúng.
 */
export async function bookQtyAt(
  at: string,
  materialIds: string[],
): Promise<Map<string, number>> {
  if (materialIds.length === 0) return new Map()
  const { data, error } = await db().rpc('warehouse_book_qty_at', {
    p_at: at,
    p_material_ids: materialIds,
  })
  if (error) throw new Error(error.message)
  const out = new Map<string, number>()
  for (const r of (data as { material_id: string; qty: unknown }[] | null) ?? []) {
    out.set(r.material_id, Number(r.qty ?? 0))
  }
  return out
}

/**
 * Mã vật tư thuộc một PHẠM VI. Trả danh sách id đã khử trùng.
 *
 * Không nhận phạm vi rỗng và không có đường "cả danh mục": đó là điểm của
 * việc bắt chọn phạm vi (Đợt 1 chặn đường đếm cả 13.229 mã).
 */
export async function materialsInScope(scope: StocktakeScope): Promise<string[]> {
  const ids = new Set<string>()

  if (scope.kind === 'list') {
    for (const id of scope.material_ids) ids.add(id)
    return [...ids]
  }

  if (scope.kind === 'group') {
    for (let from = 0; ; from += 1000) {
      const { data } = await db()
        .from('warehouse_materials')
        .select('id')
        .eq('is_active', true)
        .in('group_name', scope.groups)
        .range(from, from + 999)
      const rows = (data as { id: string }[] | null) ?? []
      for (const r of rows) ids.add(r.id)
      if (rows.length < 1000) break
    }
    return [...ids]
  }

  /*
   * Phạm vi THEO KHU: mã nào đang CÓ LƯỢNG ở khu đó — đọc từ dòng sổ chứ
   * không từ `warehouse_materials.shelf_location`.
   *
   * Cột `shelf_location` là kệ GỢI Ý trên danh mục, không phải nơi hàng đang
   * nằm. Đếm theo nó là đi tới kệ A tìm những mã "lẽ ra ở A", trong khi thứ
   * thật sự nằm ở A lại không có trong danh sách — kiểm kê kiểu đó không phát
   * hiện được đúng loại sai mà nó sinh ra để phát hiện.
   */
  for (let from = 0; ; from += 1000) {
    const { data } = await db()
      .from('warehouse_movements')
      .select('material_id')
      .in('bin_id', scope.bin_ids)
      .range(from, from + 999)
    const rows = (data as { material_id: string }[] | null) ?? []
    for (const r of rows) ids.add(r.material_id)
    if (rows.length < 1000) break
  }
  return [...ids]
}
