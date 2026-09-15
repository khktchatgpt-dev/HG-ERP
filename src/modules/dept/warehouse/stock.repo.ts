import { db } from '@/server/db'
import { searchTokens } from '@/lib/search-text'

export type StockRow = {
  material_id: string
  code: string
  name: string
  unit: string
  group_name: string | null
  min_stock: number
  shelf_location: string | null
  is_active: boolean
  /** TỔNG mọi trạng thái — giữ nghĩa cũ, mọi nơi đang đọc không gãy. */
  on_hand: number
  /** on_hand < min_stock (FR-WMS-08). */
  is_low: boolean
  /**
   * DÙNG ĐƯỢC (0194) — số DUY NHẤT được phép dùng để tính đủ/thiếu.
   *
   * Lấy `on_hand` để tính là hứa hộ nhà kho một thứ nó không giao nổi: 2.400
   * con bulon đang chờ kiểm vẫn nằm trong `on_hand` nhưng cấp đi không được.
   */
  qty_ok: number
  /** Đã nhận, chưa được phép dùng — chờ người kiểm hàng. */
  qty_qc: number
  /** Hỏng / sai quy cách, chờ quyết trả NCC hay huỷ. */
  qty_blocked: number
}

export type Direction = 'in' | 'out'

/** Trạng thái của LƯỢNG (0194) — xem chú ở `StockRow.qty_ok`. */
export type StockStatus = 'ok' | 'qc' | 'blocked'

/**
 * Loại khu (0193). Ba loại sau là KHU ẢO — không phải chỗ thật nào cả:
 *   receiving  hàng vừa nhận, chưa cất → chính là hàng đợi "Chờ cất"
 *   blocked    đã vào sổ nhưng chưa được dùng
 *   scrap      chờ thanh lý
 * Nhờ chúng, mọi lượng luôn ở một chỗ CÓ TÊN — không lượng nào "biến mất".
 */
export type BinKind = 'store' | 'receiving' | 'blocked' | 'scrap'

export type Bin = {
  id: string
  code: string
  name: string | null
  kind: BinKind
  is_active: boolean
}

export type Movement = {
  id: string
  material_id: string
  direction: Direction
  qty: number
  qty_rejected: number
  qc_status: string | null
  ref_type: string
  /**
   * Mã lý do của dòng (0197). Null = dòng ghi trước Đợt 3, HOẶC đường ghi chưa
   * suy được mã chắc chắn. Chỗ hiển thị/lọc gọi `suyMaTuLichSu(ref_type,
   * direction)` để lấp, đừng coi null là "không có lý do".
   */
  reason_code: string | null
  ref_no: string | null
  shelf_location: string | null
  note: string | null
  created_by: string | null
  created_at: string
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

const STOCK_COLS =
  'material_id, code, name, unit, group_name, min_stock, shelf_location, is_active, on_hand, is_low, qty_ok, qty_qc, qty_blocked'

const MV_COLS =
  'id, material_id, direction, qty, qty_rejected, qc_status, ref_type, reason_code, ref_no, shelf_location, note, created_by, created_at'

function num(v: unknown): number {
  return Number(v ?? 0)
}

/**
 * RỔ của màn Tồn kho (Đợt 1 — `docs/thiet-ke-kho.md` §6).
 *
 * `has` là MẶC ĐỊNH, không phải `all`: danh mục 13.229 mã nhưng tập làm việc
 * thật là số mã đang có tồn. Mặc định `all` thì mỗi lần mở màn là kéo cả danh
 * mục xuống trình duyệt để lọc bằng tay — đúng lối mòn "màn hình = một cái
 * bảng" mà bản thiết kế chỉ ra.
 *
 * `short` KHÔNG lọc được bằng SQL: nó cần `reserved` (nhu cầu LSX đã cam kết),
 * không nằm trong view. Service xử riêng — xem `listStockPage`.
 */
export type StockBucket = 'has' | 'low' | 'out' | 'qc' | 'blocked' | 'short' | 'all'

function rowOf(r: Record<string, unknown>): StockRow {
  return {
    material_id: r.material_id as string,
    code: r.code as string,
    name: r.name as string,
    unit: r.unit as string,
    group_name: (r.group_name as string | null) ?? null,
    min_stock: num(r.min_stock),
    shelf_location: (r.shelf_location as string | null) ?? null,
    is_active: r.is_active as boolean,
    on_hand: num(r.on_hand),
    // Cột view (0160): min_stock > 0 && on_hand < min — đồng nhất với sweep
    // quét sáng + notifyLowStock, và là cột SQL lọc được.
    is_low: Boolean(r.is_low),
    qty_ok: num(r.qty_ok),
    qty_qc: num(r.qty_qc),
    qty_blocked: num(r.qty_blocked),
  }
}

export const stockRepo = {
  async list(filter: {
    q?: string
    group_name?: string
    low_only: boolean
  }): Promise<StockRow[]> {
    const build = () => {
      let q = db()
        .from('warehouse_stock')
        .select(STOCK_COLS)
        .eq('is_active', true)
        .order('code', { ascending: true })

      if (filter.group_name) q = q.eq('group_name', filter.group_name)
      // Tìm KHÔNG DẤU trên search_text (0198 mang cột 0127 ra view) — AND
      // từng từ, nên gõ "vit 4x15" hay "4x15 vit" đều trúng. Trước đây lọc
      // code/name CÓ DẤU: gõ "vit" không bao giờ ra "vít".
      for (const t of searchTokens(filter.q ?? '')) q = q.ilike('search_text', `%${t}%`)
      // is_low (0160) lọc Ở SQL: PostgREST trần 1000 dòng/lượt — lọc client thì
      // vật tư dưới min ngoài 1000 mã đầu không bao giờ về tới nơi.
      if (filter.low_only) q = q.eq('is_low', true)
      return q
    }
    // Quét hết theo trang (03/09/2026): không lọc gì thì view này là cả danh
    // mục 13k mã — một lượt chỉ về 1000 dòng ĐẦU BẢNG CHỮ CÁI, im lặng, nên màn
    // "mua bù tồn" và các bảng tổng hợp từng thiếu mọi mã từ chữ M trở đi.
    const data: Record<string, unknown>[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await build().range(from, from + 999)
      const rows = (page as Record<string, unknown>[] | null) ?? []
      data.push(...rows)
      if (rows.length < 1000) break
    }
    return data.map(rowOf)
  },

  /**
   * MỘT TRANG tồn kho — lọc, xếp và ĐẾM Ở SERVER (Đợt 1).
   *
   * Thay `list()` cho màn Tồn kho. `list()` giữ nguyên cho các nơi thật sự cần
   * quét hết (mua bù tồn, bảng tổng hợp, xuất Excel) — chúng chạy nền, không
   * phải là màn người dùng mở 20 lần/ngày.
   *
   * TÌM theo `code`/`name` CÓ DẤU: view `warehouse_stock` không có cột
   * `search_text` không dấu như bảng `warehouse_materials`. Gõ "vit" không ra
   * "vít". Vá được bằng cách thêm cột vào view — để Đợt 2 cùng lượt sửa view
   * chứ không đẻ một migration chỉ cho một cột.
   */
  async page(filter: {
    q?: string
    group_name?: string
    bucket: Exclude<StockBucket, 'short'>
    ids?: string[]
    page: number
    page_size: number
  }): Promise<{ rows: StockRow[]; total: number }> {
    let q = db()
      .from('warehouse_stock')
      .select(STOCK_COLS, { count: 'exact' })
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (filter.group_name) q = q.eq('group_name', filter.group_name)
    // Tìm KHÔNG DẤU trên search_text (0198 mang cột 0127 ra view) — AND
      // từng từ, nên gõ "vit 4x15" hay "4x15 vit" đều trúng. Trước đây lọc
      // code/name CÓ DẤU: gõ "vit" không bao giờ ra "vít".
      for (const t of searchTokens(filter.q ?? '')) q = q.ilike('search_text', `%${t}%`)
    if (filter.ids) q = q.in('material_id', filter.ids)
    if (filter.bucket === 'has') q = q.gt('on_hand', 0)
    else if (filter.bucket === 'low') q = q.eq('is_low', true)
    // "Hết hàng" đo trên DÙNG ĐƯỢC, không trên tổng: mã còn 2.400 con đang chờ
    // kiểm thì với người đi cấp hàng nó vẫn là hết — và đó là câu hỏi của rổ này.
    else if (filter.bucket === 'out') q = q.eq('qty_ok', 0)
    else if (filter.bucket === 'qc') q = q.gt('qty_qc', 0)
    else if (filter.bucket === 'blocked') q = q.gt('qty_blocked', 0)

    const from = (filter.page - 1) * filter.page_size
    const { data, count } = await q.range(from, from + filter.page_size - 1)
    return {
      rows: ((data as Record<string, unknown>[] | null) ?? []).map(rowOf),
      total: count ?? 0,
    }
  },

  /**
   * Đếm từng rổ — CÙNG bộ lọc q/group với `page`.
   *
   * Hai nơi lệch nhau là chip nói 5 mà mở ra thấy 7, và nguyên tắc "con số là
   * một lời hứa" hỏng ngay ở màn hay mở nhất của Kho.
   */
  async counts(filter: { q?: string; group_name?: string }): Promise<{
    all: number
    has: number
    low: number
    out: number
    qc: number
    blocked: number
  }> {
    const base = () => {
      let q = db()
        .from('warehouse_stock')
        .select('material_id', { count: 'exact', head: true })
        .eq('is_active', true)
      if (filter.group_name) q = q.eq('group_name', filter.group_name)
      // Tìm KHÔNG DẤU trên search_text (0198 mang cột 0127 ra view) — AND
      // từng từ, nên gõ "vit 4x15" hay "4x15 vit" đều trúng. Trước đây lọc
      // code/name CÓ DẤU: gõ "vit" không bao giờ ra "vít".
      for (const t of searchTokens(filter.q ?? '')) q = q.ilike('search_text', `%${t}%`)
      return q
    }
    const [all, has, low, out, qc, blocked] = await Promise.all([
      base(),
      base().gt('on_hand', 0),
      base().eq('is_low', true),
      base().eq('qty_ok', 0),
      base().gt('qty_qc', 0),
      base().gt('qty_blocked', 0),
    ])
    return {
      all: all.count ?? 0,
      has: has.count ?? 0,
      low: low.count ?? 0,
      out: out.count ?? 0,
      qc: qc.count ?? 0,
      blocked: blocked.count ?? 0,
    }
  },

  /** Tồn hiện tại của 1 vật tư (để kiểm khi xuất). */
  async onHand(materialId: string): Promise<number> {
    const { data } = await db()
      .from('warehouse_stock')
      .select('on_hand')
      .eq('material_id', materialId)
      .maybeSingle()
    return data ? num((data as { on_hand: unknown }).on_hand) : 0
  },
}

export const movementsRepo = {
  async insert(row: {
    material_id: string
    direction: Direction
    qty: number
    qty_rejected?: number
    qc_status?: string | null
    ref_type: string
    ref_no?: string | null
    shelf_location?: string | null
    note?: string | null
    created_by: string | null
  }): Promise<{ id: string }> {
    const { data, error } = await db()
      .from('warehouse_movements')
      .insert(row)
      .select('id')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert movement failed')
    return data as { id: string }
  },

  async list(filter: {
    material_id?: string
    direction?: Direction
    page: number
    page_size: number
  }): Promise<{ rows: Movement[]; total: number }> {
    let q = db()
      .from('warehouse_movements')
      .select(`${MV_COLS}, material:warehouse_materials(code, name, unit)`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })

    if (filter.material_id) q = q.eq('material_id', filter.material_id)
    if (filter.direction) q = q.eq('direction', filter.direction)

    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)

    const { data, count } = await q
    const rows = ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      const mat = (m ?? {}) as { code?: string; name?: string; unit?: string }
      return {
        id: r.id as string,
        material_id: r.material_id as string,
        direction: r.direction as Direction,
        qty: num(r.qty),
        qty_rejected: num(r.qty_rejected),
        qc_status: (r.qc_status as string | null) ?? null,
        ref_type: r.ref_type as string,
        reason_code: (r.reason_code as string | null) ?? null,
        ref_no: (r.ref_no as string | null) ?? null,
        shelf_location: (r.shelf_location as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        created_by: (r.created_by as string | null) ?? null,
        created_at: r.created_at as string,
        material_code: mat.code ?? null,
        material_name: mat.name ?? null,
        material_unit: mat.unit ?? null,
      } satisfies Movement
    })
    return { rows, total: count ?? 0 }
  },
}

// ── Phiếu kho (warehouse_docs — 0017) ──────────────────────────────────────

export type DocKind = 'receipt' | 'issue' | 'transfer' | 'stocktake'

export type WarehouseDoc = {
  id: string
  code: string
  kind: DocKind
  doc_date: string
  counterparty: string | null
  reason: string | null
  note: string | null
  /**
   * Vòng duyệt kiểm kê (0157): 'pending' chờ quản lý Kho duyệt (tồn CHƯA đổi),
   * 'posted' đã áp sổ (mặc định — mọi phiếu nhập/xuất và phiếu cũ), 'rejected'.
   */
  status: 'pending' | 'posted' | 'rejected'
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  reject_reason: string | null
  /** Phiếu ĐẢO (0161): trỏ phiếu gốc bị đảo — null = phiếu thường. */
  reversal_of_doc_id: string | null
  reversal_of_code: string | null
  /** Số phiếu giao hàng / hoá đơn của NCC (0161) — đối chiếu 3 chiều. */
  supplier_doc_no: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

/** Dòng phiếu = movement gắn doc_id, kèm thông tin vật tư + SL chứng từ (PO). */
export type DocLine = Movement & {
  po_line_id: string | null
  production_order_id: string | null
  qty_ordered: number | null // SL theo chứng từ (dòng PO) — mẫu 01-VT
}

const DOC_COLS =
  'id, code, kind, doc_date, counterparty, reason, note, status, approved_by, approved_at, reject_reason, reversal_of_doc_id, supplier_doc_no, created_by, created_at'
/*
 * warehouse_docs nay có HAI FK sang users (created_by + approved_by 0157) —
 * embed `users(name)` trần là mơ hồ, PostgREST trả lỗi. Hint đích danh.
 * BẪY: `reversal_of` (0161) là SELF-JOIN — embed kiểu !fkey trên bảng tự trỏ
 * mình mơ hồ HAI CHIỀU (cha hay con?) làm cả findById trả rỗng. Mã phiếu gốc
 * tra bằng truy vấn phụ (fillReversalCodes), không embed.
 */
const DOC_JOINS =
  'actor:users!warehouse_docs_created_by_fkey(name), approver:users!warehouse_docs_approved_by_fkey(name)'

/** Điền reversal_of_code cho các phiếu đảo trong danh sách — 1 truy vấn phụ. */
async function fillReversalCodes(rows: WarehouseDoc[]): Promise<WarehouseDoc[]> {
  const ids = [
    ...new Set(
      rows.map((r) => r.reversal_of_doc_id).filter((x): x is string => x != null),
    ),
  ]
  if (ids.length === 0) return rows
  const { data } = await db().from('warehouse_docs').select('id, code').in('id', ids)
  const codeById = new Map(
    ((data ?? []) as { id: string; code: string }[]).map((r) => [r.id, r.code]),
  )
  for (const r of rows) {
    if (r.reversal_of_doc_id) {
      r.reversal_of_code = codeById.get(r.reversal_of_doc_id) ?? null
    }
  }
  return rows
}

function toDoc(r: Record<string, unknown>): WarehouseDoc {
  const a = Array.isArray(r.actor) ? r.actor[0] : r.actor
  const ap = Array.isArray(r.approver) ? r.approver[0] : r.approver
  const rev = null as { code?: string } | null
  return {
    id: r.id,
    code: r.code,
    kind: r.kind,
    doc_date: r.doc_date,
    counterparty: r.counterparty ?? null,
    reason: r.reason ?? null,
    note: r.note ?? null,
    status: (r.status as WarehouseDoc['status']) ?? 'posted',
    approved_by: r.approved_by ?? null,
    approved_by_name: (ap as { name?: string } | null)?.name ?? null,
    approved_at: (r.approved_at as string | null) ?? null,
    reject_reason: (r.reject_reason as string | null) ?? null,
    reversal_of_doc_id: (r.reversal_of_doc_id as string | null) ?? null,
    reversal_of_code: (rev as { code?: string } | null)?.code ?? null,
    supplier_doc_no: (r.supplier_doc_no as string | null) ?? null,
    created_by: r.created_by ?? null,
    created_by_name: (a as { name?: string } | null)?.name ?? null,
    created_at: r.created_at,
  } as WarehouseDoc
}

export const docsRepo = {
  /** Số phiếu lập HÔM NAY theo loại — nuôi ô "Nhập/Xuất hôm nay" của dashboard. */
  async countTodayByKind(): Promise<Record<string, number>> {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await db()
      .from('warehouse_docs')
      .select('kind')
      .gte('created_at', `${today}T00:00:00Z`)
      .limit(500)
    const out: Record<string, number> = {}
    for (const r of (data ?? []) as { kind: string }[]) {
      out[r.kind] = (out[r.kind] ?? 0) + 1
    }
    return out
  },

  async nextCode(kind: 'PNK' | 'PXK' | 'DCK' | 'KK'): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: kind })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async insert(row: {
    code: string
    kind: DocKind
    counterparty?: string | null
    reason?: string | null
    note?: string | null
    /** PNK nhận cho đợt giao nào (0153) — null = không theo đợt. */
    shipment_id?: string | null
    /** Vòng duyệt kiểm kê (0157) — bỏ trống = 'posted' (áp sổ ngay, flow cũ). */
    status?: 'pending' | 'posted'
    /** Ngày chứng từ (K3) — bỏ trống = hôm nay (default DB). */
    doc_date?: string
    /** Số phiếu giao / hoá đơn NCC (K3). */
    supplier_doc_no?: string | null
    /** Phiếu ĐẢO (K1) — trỏ phiếu gốc. */
    reversal_of_doc_id?: string
    created_by: string
  }): Promise<{ id: string; code: string }> {
    const { data, error } = await db()
      .from('warehouse_docs')
      .insert(row)
      .select('id, code')
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert doc failed')
    return data as { id: string; code: string }
  },

  /** Duyệt / từ chối kiểm kê (0157) — chỉ 4 cột vòng duyệt. */
  async patchStatus(
    id: string,
    patch: {
      status: 'posted' | 'rejected'
      approved_by: string
      approved_at: string
      reject_reason?: string | null
    },
  ): Promise<void> {
    const { error } = await db().from('warehouse_docs').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** shipment_id của phiếu (0153) — không nằm trong DOC_COLS, chỉ K1 cần khi đảo. */
  async findShipmentId(docId: string): Promise<string | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select('shipment_id')
      .eq('id', docId)
      .maybeSingle()
    return (
      ((data as { shipment_id: string | null } | null)?.shipment_id as string) ?? null
    )
  },

  /** Phiếu ĐẢO của một phiếu (K1) — null = chưa bị đảo. Mỗi phiếu tối đa một. */
  async findReversalOf(docId: string): Promise<{ id: string; code: string } | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select('id, code')
      .eq('reversal_of_doc_id', docId)
      .maybeSingle()
    return (data as { id: string; code: string } | null) ?? null
  },

  /** Đếm phiếu theo loại trên TOÀN SỔ — stats của Sổ chứng từ khi đã phân trang. */
  async countByKind(): Promise<{ total: number; receipt: number; issue: number }> {
    const head = (kind?: DocKind) => {
      let q = db().from('warehouse_docs').select('id', { count: 'exact', head: true })
      if (kind) q = q.eq('kind', kind)
      return q
    }
    const [t, r, i] = await Promise.all([head(), head('receipt'), head('issue')])
    return { total: t.count ?? 0, receipt: r.count ?? 0, issue: i.count ?? 0 }
  },

  /** Biên bản kiểm kê CHỜ DUYỆT — nuôi màn duyệt + ô dashboard. */
  async countPending(): Promise<number> {
    const { count } = await db()
      .from('warehouse_docs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    return count ?? 0
  },

  async list(filter: {
    kind?: DocKind
    page: number
    page_size: number
  }): Promise<{ rows: WarehouseDoc[]; total: number }> {
    let q = db()
      .from('warehouse_docs')
      .select(`${DOC_COLS}, ${DOC_JOINS}`, { count: 'exact' })
      .order('created_at', { ascending: false })
    if (filter.kind) q = q.eq('kind', filter.kind)
    const from = (filter.page - 1) * filter.page_size
    q = q.range(from, from + filter.page_size - 1)
    const { data, count } = await q
    const rows = await fillReversalCodes(
      ((data as Record<string, unknown>[] | null) ?? []).map(toDoc),
    )
    return { rows, total: count ?? 0 }
  },

  async findById(id: string): Promise<WarehouseDoc | null> {
    const { data } = await db()
      .from('warehouse_docs')
      .select(`${DOC_COLS}, ${DOC_JOINS}`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    const [doc] = await fillReversalCodes([toDoc(data as Record<string, unknown>)])
    return doc
  },

  /** Dòng của 1 phiếu + SL đặt trên dòng PO (in "theo chứng từ" của mẫu 01-VT). */
  async listLines(docId: string): Promise<DocLine[]> {
    const { data } = await db()
      .from('warehouse_movements')
      .select(
        `${MV_COLS}, po_line_id, production_order_id, material:warehouse_materials(code, name, unit), po_line:supply_purchase_order_lines(qty_ordered)`,
      )
      .eq('doc_id', docId)
      .order('created_at')
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      const mat = (m ?? {}) as { code?: string; name?: string; unit?: string }
      const pl = Array.isArray(r.po_line) ? r.po_line[0] : r.po_line
      return {
        id: r.id as string,
        material_id: r.material_id as string,
        direction: r.direction as Direction,
        qty: num(r.qty),
        qty_rejected: num(r.qty_rejected),
        qc_status: (r.qc_status as string | null) ?? null,
        ref_type: r.ref_type as string,
        reason_code: (r.reason_code as string | null) ?? null,
        ref_no: (r.ref_no as string | null) ?? null,
        shelf_location: (r.shelf_location as string | null) ?? null,
        note: (r.note as string | null) ?? null,
        created_by: (r.created_by as string | null) ?? null,
        created_at: r.created_at as string,
        material_code: mat.code ?? null,
        material_name: mat.name ?? null,
        material_unit: mat.unit ?? null,
        po_line_id: (r.po_line_id as string | null) ?? null,
        production_order_id: (r.production_order_id as string | null) ?? null,
        qty_ordered: pl ? num((pl as { qty_ordered: unknown }).qty_ordered) : null,
      } satisfies DocLine
    })
  },
}

// ── Kiểm kê (warehouse_stocktake_lines — 0077) ─────────────────────────────

/** 1 dòng biên bản kiểm kê (kèm thông tin vật tư để hiển thị/in). */
export type StocktakeLine = {
  id: string
  doc_id: string
  material_id: string
  system_qty: number
  counted_qty: number
  diff: number
  note: string | null
  material_code: string | null
  material_name: string | null
  material_unit: string | null
}

export const stocktakeRepo = {
  async insertLines(
    rows: {
      doc_id: string
      material_id: string
      system_qty: number
      counted_qty: number
      diff: number
      note?: string | null
    }[],
  ): Promise<void> {
    if (rows.length === 0) return
    const { error } = await db().from('warehouse_stocktake_lines').insert(rows)
    if (error) throw new Error(error.message)
  },

  /** Biên bản đầy đủ của 1 phiếu KK — mọi dòng đã đếm, kể cả khớp sổ. */
  async listByDoc(docId: string): Promise<StocktakeLine[]> {
    const { data } = await db()
      .from('warehouse_stocktake_lines')
      .select(
        'id, doc_id, material_id, system_qty, counted_qty, diff, note, material:warehouse_materials(code, name, unit)',
      )
      .eq('doc_id', docId)
      .order('created_at')
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => {
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      const mat = (m ?? {}) as { code?: string; name?: string; unit?: string }
      return {
        id: r.id as string,
        doc_id: r.doc_id as string,
        material_id: r.material_id as string,
        system_qty: num(r.system_qty),
        counted_qty: num(r.counted_qty),
        diff: num(r.diff),
        note: (r.note as string | null) ?? null,
        material_code: mat.code ?? null,
        material_name: mat.name ?? null,
        material_unit: mat.unit ?? null,
      } satisfies StocktakeLine
    })
  },
}

export const warehousesRepo = {
  /** Kho chính (GĐ1 chỉ 1 kho — FR-WMS-10 seed 'MAIN' từ 0011). */
  async mainId(): Promise<string> {
    const { data, error } = await db()
      .from('warehouses')
      .select('id')
      .eq('code', 'MAIN')
      .single()
    if (error || !data) throw new Error('Kho MAIN chưa được seed (migration 0011)')
    return (data as { id: string }).id
  },
}

const BIN_COLS = 'id, code, name, kind, is_active'

export const binsRepo = {
  /** Mọi khu của kho, kể cả đã ngừng dùng — màn Sơ đồ kệ cần thấy cả hai. */
  async list(warehouseId: string, opts: { active_only?: boolean } = {}): Promise<Bin[]> {
    let q = db()
      .from('warehouse_bins')
      .select(BIN_COLS)
      .eq('warehouse_id', warehouseId)
      .order('kind', { ascending: true })
      .order('code', { ascending: true })
    if (opts.active_only) q = q.eq('is_active', true)
    const { data } = await q
    return ((data as Bin[] | null) ?? []).map((b) => ({ ...b, kind: b.kind as BinKind }))
  },

  /**
   * Khu ảo theo LOẠI — `receiving` cho hàng vừa nhận, `blocked` cho hàng khoá.
   *
   * Tra theo `kind` chứ KHÔNG hằng số hoá mã 'TIEP-NHAN' / 'KHOA-01': mã là
   * nhãn người đọc, đổi được; loại là hợp đồng của hệ thống. Hằng số hoá mã thì
   * ai đó đổi tên khu cho dễ đọc là luồng nhận hàng gãy im lặng.
   */
  async byKind(warehouseId: string, kind: BinKind): Promise<Bin | null> {
    const { data } = await db()
      .from('warehouse_bins')
      .select(BIN_COLS)
      .eq('warehouse_id', warehouseId)
      .eq('kind', kind)
      .eq('is_active', true)
      .order('code', { ascending: true })
      .limit(1)
      .maybeSingle()
    return data ? { ...(data as Bin), kind: (data as Bin).kind as BinKind } : null
  },

  async findById(id: string): Promise<Bin | null> {
    const { data } = await db()
      .from('warehouse_bins')
      .select(BIN_COLS)
      .eq('id', id)
      .maybeSingle()
    return data ? { ...(data as Bin), kind: (data as Bin).kind as BinKind } : null
  },

  async insert(row: {
    warehouse_id: string
    code: string
    name: string | null
    kind: BinKind
  }): Promise<Bin> {
    const { data, error } = await db()
      .from('warehouse_bins')
      .insert(row)
      .select(BIN_COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Tạo khu thất bại')
    return { ...(data as Bin), kind: (data as Bin).kind as BinKind }
  },

  async patch(
    id: string,
    patch: { name?: string | null; is_active?: boolean },
  ): Promise<void> {
    const { error } = await db().from('warehouse_bins').update(patch).eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** Số mã đang nằm ở từng khu — nuôi cột "Mã đang nằm" của Sơ đồ kệ. */
  async materialCountByBin(): Promise<Map<string, number>> {
    const { data } = await db()
      .from('v_warehouse_stock_by_bin')
      .select('bin_id, material_id')
      .limit(20000)
    const out = new Map<string, Set<string>>()
    for (const r of (data as { bin_id: string | null; material_id: string }[] | null) ??
      []) {
      if (!r.bin_id) continue
      const set = out.get(r.bin_id) ?? new Set<string>()
      set.add(r.material_id)
      out.set(r.bin_id, set)
    }
    return new Map([...out].map(([k, v]) => [k, v.size]))
  },
}

export type StockByBin = {
  material_id: string
  bin_id: string | null
  bin_code: string | null
  bin_name: string | null
  bin_kind: BinKind | null
  stock_status: StockStatus
  qty: number
}

/**
 * Tồn theo (vật tư × khu × trạng thái) — nguồn của màn Chờ cất và tab "Tồn
 * theo kệ" trên hồ sơ vật tư. View đã bỏ các cặp tổng bằng 0.
 */
export async function stockByBin(filter: {
  bin_kind?: BinKind
  material_ids?: string[]
}): Promise<StockByBin[]> {
  let q = db().from('v_warehouse_stock_by_bin').select('*').limit(5000)
  if (filter.bin_kind) q = q.eq('bin_kind', filter.bin_kind)
  if (filter.material_ids) q = q.in('material_id', filter.material_ids)
  const { data } = await q
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    material_id: r.material_id as string,
    bin_id: (r.bin_id as string | null) ?? null,
    bin_code: (r.bin_code as string | null) ?? null,
    bin_name: (r.bin_name as string | null) ?? null,
    bin_kind: (r.bin_kind as BinKind | null) ?? null,
    stock_status: r.stock_status as StockStatus,
    qty: num(r.qty),
  }))
}

/** Insert nhiều movement 1 lần (các dòng của 1 phiếu). */
export async function insertMovements(
  rows: {
    material_id: string
    direction: Direction
    qty: number
    qty_rejected?: number
    qc_status?: string | null
    ref_type: string
    ref_no?: string | null
    shelf_location?: string | null
    note?: string | null
    created_by: string
    doc_id: string
    warehouse_id: string
    po_line_id?: string | null
    production_order_id?: string | null
    /**
     * Giá vốn một đơn vị (0015). NULL = CHƯA BIẾT GIÁ, khác hẳn 0 = "cho không"
     * — màn công nợ đếm "phiếu chưa có giá" dựa đúng vào phân biệt này.
     */
    unit_cost?: number | null
    /**
     * Mã lý do của DÒNG (0197, `lib/kho-ma-ly-do.ts`). Bỏ trống khi không suy
     * được chắc chắn từ dữ liệu đã có — để null giống 265 dòng cũ, đừng dán
     * một mã "khác" lên rồi báo cáo kế toán đếm phải con số bịa. Bắt buộc là
     * việc của UI soạn phiếu khi màn đó có ô chọn.
     */
    reason_code?: string | null
    /** Khu/kệ lượng này nằm (0193). Dòng mới luôn có — service ép. */
    bin_id?: string | null
    /** Trạng thái của lượng (0194): dùng được / chờ kiểm / khoá. */
    stock_status?: StockStatus
    /**
     * Nối HAI CHÂN của một lần điều chuyển (0015). Ràng buộc DB:
     * `ref_type = 'transfer'` thì cột này BẮT BUỘC có.
     *
     * Chuyển kệ và đổi trạng thái đều là "ra khỏi chỗ cũ, vào chỗ mới" — hai
     * dòng sổ, không phải một UPDATE tại chỗ. Sổ chỉ cộng thêm, không sửa lùi.
     */
    transfer_group?: string | null
  }[],
): Promise<void> {
  const { error } = await db().from('warehouse_movements').insert(rows)
  if (error) throw new Error(error.message)
}

/** Tồn hiện tại của nhiều vật tư (guard xuất nhiều dòng). */
export async function onHandMany(materialIds: string[]): Promise<Map<string, number>> {
  if (materialIds.length === 0) return new Map()
  const { data } = await db()
    .from('warehouse_stock')
    .select('material_id, on_hand, min_stock, code, name')
    .in('material_id', materialIds)
  const map = new Map<string, number>()
  for (const r of (data as { material_id: string; on_hand: unknown }[] | null) ?? []) {
    map.set(r.material_id, num(r.on_hand))
  }
  return map
}

/** Tồn + min_stock (check cảnh báo sau xuất — FR-WMS-08). */
/**
 * Mô tả gọn của nhiều vật tư — mã, tên, ĐVT, kệ gợi ý. Cho màn Chờ cất.
 *
 * Không dùng `stockInfoMany`: bản kia đọc view TỒN và trả về số tồn, còn ở đây
 * chỉ cần nhãn để hiện dòng. Nhét thêm cột vào bản kia là bắt mọi nơi gọi nó
 * kéo theo hai cột không dùng.
 *
 * `shelf_location` sau 0193 mang nghĩa "KỆ GỢI Ý MẶC ĐỊNH" — điền sẵn lúc cất,
 * sửa được. Nó không còn là nơi hàng đang nằm; nơi thật là `bin_id` trên sổ.
 */
export async function materialLabels(
  materialIds: string[],
): Promise<
  Map<string, { code: string; name: string; unit: string; shelf: string | null }>
> {
  if (materialIds.length === 0) return new Map()
  const { data } = await db()
    .from('warehouse_materials')
    .select('id, code, name, unit, shelf_location')
    .in('id', materialIds)
  const out = new Map<
    string,
    { code: string; name: string; unit: string; shelf: string | null }
  >()
  for (const r of (data as
    | {
        id: string
        code: string
        name: string
        unit: string
        shelf_location: string | null
      }[]
    | null) ?? []) {
    out.set(r.id, {
      code: r.code,
      name: r.name,
      unit: r.unit,
      shelf: r.shelf_location ?? null,
    })
  }
  return out
}

export async function stockInfoMany(materialIds: string[]): Promise<
  {
    material_id: string
    code: string
    name: string
    /** DÙNG ĐƯỢC — nền tính "dưới mức" từ 0198, xem header migration. */
    qty_ok: number
    on_hand: number
    min_stock: number
  }[]
> {
  if (materialIds.length === 0) return []
  const { data } = await db()
    .from('warehouse_stock')
    .select('material_id, code, name, qty_ok, on_hand, min_stock')
    .in('material_id', materialIds)
  return (
    (data as
      | {
          material_id: string
          code: string
          name: string
          qty_ok: unknown
          on_hand: unknown
          min_stock: unknown
        }[]
      | null) ?? []
  ).map((r) => ({
    material_id: r.material_id,
    code: r.code,
    name: r.name,
    qty_ok: num(r.qty_ok),
    on_hand: num(r.on_hand),
    min_stock: num(r.min_stock),
  }))
}

/** Nhu cầu vật tư theo LSX: cần (BOM×SL) − đã xuất (view v_lsx_material_status, gap G-2). */
export type LsxNeed = {
  production_order_id: string
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  qty_issued: number
  qty_remaining: number
  // Nhánh bảng chi tiết (plan-lsx-components P3) — hiển thị tham khảo cho người mua.
  kg_needed?: number | null
  bars_needed?: number | null
  incomplete?: boolean
  source?: 'components' | 'bom'
  /** Có phần định mức từ SP chưa xác nhận BOM — màn hình phải cảnh báo. */
  unconfirmed?: boolean
}

/** Đã xuất theo LSX gộp theo vật tư — cho nhánh nhu cầu từ bảng chi tiết (P3). */
/**
 * Đã cấp cho LSX = NET Σ xuất − Σ nhập cùng lệnh (K2 go-live): xưởng dùng
 * không hết trả về kho (PNK "Hoàn kho từ LSX") hay phiếu xuất bị ĐẢO (K1)
 * đều là movement `in` gắn production_order_id — không trừ lại thì "đã cấp"
 * phồng, nhu cầu còn lại của lệnh âm sai.
 */
export async function issuedByLsx(
  productionOrderId: string,
): Promise<Map<string, number>> {
  const { data } = await db()
    .from('warehouse_movements')
    .select('material_id, direction, qty')
    .eq('production_order_id', productionOrderId)
    .limit(5000)
  const map = new Map<string, number>()
  for (const r of (data ?? []) as {
    material_id: string
    direction: 'in' | 'out'
    qty: number
  }[]) {
    const signed = r.direction === 'out' ? Number(r.qty) : -Number(r.qty)
    map.set(r.material_id, (map.get(r.material_id) ?? 0) + signed)
  }
  return map
}

/** Đã xuất theo NHIỀU LSX (gộp dòng) — nguồn tính tồn đặt trước (bước 2 Kho). */
/** Bản nhiều lệnh của issuedByLsx — cùng luật NET xuất − nhập (K2). */
export async function issuedByLsxIds(
  productionOrderIds: string[],
): Promise<{ production_order_id: string; material_id: string; qty: number }[]> {
  if (productionOrderIds.length === 0) return []
  const { data } = await db()
    .from('warehouse_movements')
    .select('production_order_id, material_id, direction, qty')
    .in('production_order_id', productionOrderIds)
    .limit(10000)
  return (
    (data as
      | {
          production_order_id: string
          material_id: string
          direction: 'in' | 'out'
          qty: unknown
        }[]
      | null) ?? []
  ).map((r) => ({
    production_order_id: r.production_order_id,
    material_id: r.material_id,
    qty: r.direction === 'out' ? num(r.qty) : -num(r.qty),
  }))
}

/** Nhu cầu còn lại theo BOM của NHIỀU LSX (view) — cho LSX chưa nhập bảng chi tiết. */
export async function lsxRemainingByIds(
  productionOrderIds: string[],
): Promise<
  { production_order_id: string; material_id: string; qty_remaining: number }[]
> {
  if (productionOrderIds.length === 0) return []
  const { data } = await db()
    .from('v_lsx_material_status')
    .select('production_order_id, material_id, qty_remaining')
    .in('production_order_id', productionOrderIds)
    .limit(10000)
  return (
    (data as
      | { production_order_id: string; material_id: string; qty_remaining: unknown }[]
      | null) ?? []
  ).map((r) => ({
    production_order_id: r.production_order_id,
    material_id: r.material_id,
    qty_remaining: num(r.qty_remaining),
  }))
}

export async function lsxNeeds(productionOrderId: string): Promise<LsxNeed[]> {
  const { data } = await db()
    .from('v_lsx_material_status')
    .select('*')
    .eq('production_order_id', productionOrderId)
  return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
    production_order_id: r.production_order_id as string,
    material_id: r.material_id as string,
    material_code: r.material_code as string,
    material_name: r.material_name as string,
    unit: r.unit as string,
    qty_needed: num(r.qty_needed),
    qty_issued: num(r.qty_issued),
    qty_remaining: num(r.qty_remaining),
  }))
}

/**
 * PHÂN BỔ THEO SẢN PHẨM từ BOM × SL đơn (khoá = MÃ vật tư) — fallback cho lệnh
 * CHƯA nhập bảng chi tiết, cùng nguồn với nhánh need của v_lsx_material_status
 * (0113): dòng SP của mọi đơn thuộc lệnh × định mức technical_product_parts.
 * Nguồn cho ghi chú "300 Bàn 65 gỗ (4c/sp)" trên dòng đơn đặt.
 */
export async function bomAllocationByCode(
  productionOrderId: string,
): Promise<Map<string, { product: string; qty: number; per_unit: number | null }[]>> {
  const out = new Map<
    string,
    { product: string; qty: number; per_unit: number | null }[]
  >()
  const { data: lines } = await db()
    .from('sales_order_lines')
    .select(
      'product_id, qty, product:technical_products(name), order:sales_orders!inner(production_order_id)',
    )
    .eq('order.production_order_id', productionOrderId)
    .limit(2000)
  type LineRow = {
    product_id: string
    qty: unknown
    product: { name: string } | { name: string }[] | null
  }
  const lineRows = ((lines ?? []) as unknown as LineRow[])
    .map((r) => {
      const p = Array.isArray(r.product) ? r.product[0] : r.product
      return { product_id: r.product_id, qty: num(r.qty), name: p?.name ?? '' }
    })
    .filter((r) => r.qty > 0 && r.product_id)
  if (lineRows.length === 0) return out

  const productIds = [...new Set(lineRows.map((r) => r.product_id))]
  // Định mức gộp theo (SP, mã VT): một vật tư dùng cho nhiều chi tiết của cùng
  // SP thì đm cộng dồn — "chân trước 2c + chân sau 2c" ra 4c/sp như sổ ghi.
  const perUnit = new Map<string, number>()

  /*
   * ƯU TIÊN ẢNH CHỤP ĐỊNH MỨC CỦA LỆNH (0142) — cùng nguồn với
   * v_lsx_material_status. Ghi chú phân bổ trên dòng đơn đặt ("4c/sp") mà đọc
   * định mức sống trong khi số lượng cần đọc bản đã chốt thì hai con số trên
   * cùng một dòng phiếu sẽ chửi nhau.
   */
  const { data: snap } = await db()
    .from('production_order_boms')
    .select('product_id, material_code, qty_per_unit')
    .eq('production_order_id', productionOrderId)
    .limit(10000)
  const snapped = new Set<string>()
  for (const s of snap ?? []) {
    snapped.add(s.product_id)
    perUnit.set(`${s.product_id}::${s.material_code}`, num(s.qty_per_unit))
  }

  const liveIds = productIds.filter((id) => !snapped.has(id))
  if (liveIds.length) {
    const { data: parts } = await db()
      .from('technical_product_parts')
      .select('product_id, material_code, qty')
      .in('product_id', liveIds)
      .not('material_code', 'is', null)
      .limit(10000)
    for (const p of (parts ?? []) as {
      product_id: string
      material_code: string
      qty: unknown
    }[]) {
      const key = `${p.product_id}::${p.material_code}`
      perUnit.set(key, (perUnit.get(key) ?? 0) + num(p.qty))
    }
  }
  for (const [key, dm] of perUnit) {
    const [productId, materialCode] = key.split('::')
    for (const line of lineRows.filter((l) => l.product_id === productId)) {
      const list = out.get(materialCode) ?? []
      list.push({
        product: line.name.trim().split('\n')[0] || '—',
        qty: line.qty,
        per_unit: dm > 0 ? dm : null,
      })
      out.set(materialCode, list)
    }
  }
  return out
}

/**
 * Nhóm vật tư có bật "cần kiểm hàng" — `catalog_items.meta->>'needs_inspection'`
 * (khai ở 0194, type `material_group`). Trả về tập TÊN NHÓM để so thẳng với
 * `warehouse_materials.group_name`, vốn giữ nhãn chứ không giữ mã.
 *
 * 0194 khai cờ này rồi để đó — sổ §4.4 gọi đúng tên nó là "một lời hứa treo".
 * Đây là chỗ đọc nó. Mặc định KHÔNG nhóm nào bật: chủ dự án chốt 15/09/2026
 * rằng thủ kho vừa nhận vừa kiểm, nên tập này rỗng và hệ thống hành xử y hệt
 * phương án hai trạng thái. Bật một nhóm là sửa một dòng dữ liệu, không phải
 * sửa mã — đó là lý do cờ đáng giữ dù hôm nay không ai dùng.
 */
export async function inspectionGroups(): Promise<Set<string>> {
  const { data } = await db()
    .from('catalog_items')
    .select('label, meta')
    .eq('type', 'material_group')
    .eq('is_active', true)
  const out = new Set<string>()
  for (const r of (data as { label: string; meta: unknown }[] | null) ?? []) {
    const meta = (r.meta ?? {}) as Record<string, unknown>
    const v = meta.needs_inspection
    if (v === true || v === 'true') out.add(r.label)
  }
  return out
}
