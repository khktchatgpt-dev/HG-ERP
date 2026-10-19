import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import { theoLo } from '@/server/theo-lo'
import { danhSachDem, mocPhatSinh, type NhomDem } from '@/lib/kho-kiem-ke'

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
  /** Kệ gợi ý trên danh mục (lọc phiếu đếm theo kệ). */
  material_shelf: string | null
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
          'id, material_id, book_qty_frozen, counted_qty, counted_by, counted_at, note, material:warehouse_materials(code, name, unit, shelf_location)',
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
          shelf_location?: string | null
        }
        out.push({
          id: r.id as string,
          material_id: r.material_id as string,
          material_code: mat.code ?? null,
          material_name: mat.name ?? null,
          material_unit: mat.unit ?? null,
          material_shelf: mat.shelf_location ?? null,
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
    // Q1 (B7, 19/10/2026): có tồn ∪ có phiếu 180 ngày — KHÔNG cả nhóm danh mục.
    for (const n of await danhSachDemNhom(scope.groups))
      for (const id of n.ids) ids.add(id)
    return [...ids]
  }

  /*
   * Phạm vi THEO KHU: mã nào ĐANG CÓ LƯỢNG ở khu đó.
   *
   * KHÔNG đọc `warehouse_materials.shelf_location` — cột đó là kệ GỢI Ý trên
   * danh mục, không phải nơi hàng đang nằm. Đếm theo nó là đi tới kệ A tìm
   * những mã "lẽ ra ở A", trong khi thứ thật sự nằm ở A lại không có trong
   * danh sách.
   *
   * VÀ KHÔNG đọc thẳng `warehouse_movements` (bản đầu làm vậy, sai): nó lấy
   * mọi mã TỪNG đi qua khu, kể cả đã hết sạch. Sau một năm mỗi khu có hàng
   * nghìn mã lịch sử và danh sách đếm thành vô dụng. Tệ hơn: hộp mở đợt bày
   * số mã lấy từ `binsRepo.materialCountByBin` (đọc view by_bin) — hai nguồn
   * lệch nhau thì con số trên hộp không phải con số sẽ đếm, đúng thứ nguyên
   * tắc "con số là một lời hứa" cấm. Một nguồn: view.
   *
   * HẠN CHẾ CÓ THẬT, ghi để đừng ngạc nhiên: mã mà sổ nói 0 nhưng ngoài kệ
   * còn hàng sẽ KHÔNG vào danh sách đếm theo khu. Muốn bắt loại lệch đó thì
   * đếm theo NHÓM (lấy cả mã tồn 0), hoặc thủ kho báo để thêm tay.
   */
  for (let from = 0; ; from += 1000) {
    const { data } = await db()
      .from('v_warehouse_stock_by_bin')
      .select('material_id')
      .in('bin_id', scope.bin_ids)
      .range(from, from + 999)
    const rows = (data as { material_id: string }[] | null) ?? []
    for (const r of rows) ids.add(r.material_id)
    if (rows.length < 1000) break
  }
  return [...ids]
}

/** Đọc hết các trang của một truy vấn (PostgREST cắt im lặng ở 1000 dòng). */
async function hetTrang<T>(
  q: (
    tu: number,
    den: number,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  // prettier-ignore
  const out: T[] = []
  for (let tu = 0; ; tu += 1000) {
    const { data, error } = await q(tu, tu + 999)
    if (error) throw new Error(error.message)
    const rows = (data as T[] | null) ?? []
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

/**
 * DANH SÁCH ĐẾM THEO NHÓM (Q1) — nguồn DUY NHẤT cho cả số trên hộp mở đợt lẫn
 * dòng phiếu đếm (`materialsInScope`). Luật gộp ở `lib/kho-kiem-ke.ts`.
 *
 * Có tồn đọc từ view `warehouse_stock` (cùng nguồn màn Tồn kho); phát sinh
 * đọc theo giờ ghi sổ trong 180 ngày.
 */
export async function danhSachDemNhom(chiNhom?: readonly string[]): Promise<NhomDem[]> {
  const [ton, mv] = await Promise.all([
    hetTrang<{ material_id: string; group_name: string | null; is_active: boolean }>(
      (tu, den) => {
        let q = db().from('warehouse_stock').select('material_id, group_name, is_active').neq('on_hand', 0) // prettier-ignore
        if (chiNhom) q = q.in('group_name', [...chiNhom])
        return q.order('material_id').range(tu, den)
      },
    ),
    hetTrang<{ material_id: string }>(
      (tu, den) =>
      db().from('warehouse_movements').select('material_id').gte('created_at', mocPhatSinh()).order('id').range(tu, den), // prettier-ignore
    ),
  ])
  const nhomCua = new Map<string, string>()
  const coTon = new Set<string>()
  for (const r of ton) {
    if (!r.is_active || !r.group_name) continue
    nhomCua.set(r.material_id, r.group_name)
    coTon.add(r.material_id)
  }
  const phatSinh = new Set(mv.map((r) => r.material_id))
  const canTra = [...phatSinh].filter((id) => !nhomCua.has(id))
  const them = await theoLo<{
    id: string
    group_name: string | null
    is_active: boolean
  }>(
    canTra,
    (lo) =>
    db().from('warehouse_materials').select('id, group_name, is_active').in('id', lo).order('id'), // prettier-ignore
  )
  for (const r of them) if (r.is_active && r.group_name) nhomCua.set(r.id, r.group_name)
  return danhSachDem(nhomCua, coTon, phatSinh, chiNhom)
}

/** Người có vai Kho (`warehouse.member`) đang hoạt động — ô "Người đếm". */
export async function nguoiKho(): Promise<{ id: string; name: string }[]> {
  const { data: rp } = await db()
    .from('role_permissions')
    .select('role_id')
    .eq('permission_key', 'warehouse.member')
  const roleIds = ((rp ?? []) as { role_id: string }[]).map((r) => r.role_id)
  if (roleIds.length === 0) return []
  const { data: ur } = await db()
    .from('user_roles')
    .select('user_id')
    .in('role_id', roleIds)
  const ids = [...new Set(((ur ?? []) as { user_id: string }[]).map((r) => r.user_id))]
  if (ids.length === 0) return []
  const { data: us } = await db()
    .from('users')
    .select('id, name, email, is_active')
    .in('id', ids)
  return (
    (us ?? []) as { id: string; name: string | null; email: string; is_active: boolean }[]
  )
    .filter((u) => u.is_active)
    .map((u) => ({ id: u.id, name: u.name ?? u.email }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
}

/** Đợt theo nhóm đã duyệt — nuôi cột "Kiểm lần cuối". */
export async function dotNhomDaDuyet(): Promise<
  { scope_kind: string; scope_ref: Record<string, unknown>; approved_at: string | null }[]
> {
  const { data } = await db()
    .from('warehouse_stocktakes')
    .select('scope_kind, scope_ref, approved_at')
    .eq('status', 'approved')
    .eq('scope_kind', 'group')
  return (data ?? []) as { scope_kind: string; scope_ref: Record<string, unknown>; approved_at: string | null }[] // prettier-ignore
}

/** Tiến độ đếm theo đợt: tổng dòng / đã có số đếm (cột "Đã đếm" của sổ đợt). */
export async function tienDoDem(
  takeIds: string[],
): Promise<Map<string, { total: number; counted: number }>> {
  const rows = await theoLo<{ stocktake_id: string; counted_qty: number | null }>(
    takeIds,
    (lo) =>
    db().from('warehouse_stocktake_lines').select('stocktake_id, counted_qty').in('stocktake_id', lo).order('id'), // prettier-ignore
  )
  const out = new Map<string, { total: number; counted: number }>()
  for (const r of rows) {
    const x = out.get(r.stocktake_id) ?? { total: 0, counted: 0 }
    x.total++
    if (r.counted_qty != null) x.counted++
    out.set(r.stocktake_id, x)
  }
  return out
}
