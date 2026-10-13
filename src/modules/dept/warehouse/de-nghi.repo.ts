import { db } from '@/server/db'
import { theoLo } from '@/server/theo-lo'
import type { DeNghiStatus } from '@/lib/de-nghi'

/**
 * Đề nghị mua vật tư (0236) — phiếu + dòng. Mọi truy vấn kiểm `error` (nuốt lỗi
 * là màn rỗng câm). Bảng có nhiều FK sang `users` nên embed phải gọi đích danh
 * tên FK.
 */
export type DeNghi = {
  id: string
  code: string
  status: DeNghiStatus
  department: string
  requested_by: string | null
  need_by: string | null
  note: string | null
  production_order_id: string | null
  submitted_at: string | null
  approved_at: string | null
  rejected_at: string | null
  rejected_reason: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  /** "Chốt xong" khi còn dòng thiếu mà không mua nữa (0238 · Q14). */
  closed_at: string | null
  closed_reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type DeNghiDong = {
  id: string
  line_no: number
  material_id: string | null
  name: string
  unit: string
  qty: number
  approved_qty: number | null
  unit_price: number | null
  purpose: string | null
  note: string | null
  po_line_id: string | null
}

/** Phiếu kèm tên người + mã lệnh + dòng — đủ cho sổ và màn chi tiết. */
export type DeNghiDay = DeNghi & {
  requested_by_name: string | null
  approved_by_name: string | null
  rejected_by_name: string | null
  closed_by_name: string | null
  lsx_code: string | null
  lines: DeNghiDong[]
}

/** Sổ kho của một dòng đề nghị: đã nhập (vào − ra), tiền thật (Σ SL × đơn giá), phiếu nhập. */
export type SoKhoDong = { daNhap: number; tien: number; phieu: PhieuNhapDong[] }

/** Một phiếu nhập kho đã nhập cho dòng đề nghị (chưa bị đảo). */
export type PhieuNhapDong = {
  doc_id: string
  code: string
  doc_date: string
  qty: number
}

const COLS =
  'id, code, status, department, requested_by, need_by, note, production_order_id, submitted_at, approved_at, rejected_at, rejected_reason, cancelled_at, cancel_reason, closed_at, closed_reason, created_by, created_at, updated_at'
const LINE_COLS =
  'id, line_no, material_id, name, unit, qty, approved_qty, unit_price, purpose, note, po_line_id'
const SEL = `${COLS},
  nguoi:users!warehouse_purchase_requests_requested_by_fkey(name, email),
  duyet:users!warehouse_purchase_requests_approved_by_fkey(name, email),
  tuchoi:users!warehouse_purchase_requests_rejected_by_fkey(name, email),
  chot:users!warehouse_purchase_requests_closed_by_fkey(name, email),
  lsx:production_orders!warehouse_purchase_requests_production_order_id_fkey(code),
  lines:warehouse_purchase_request_lines(${LINE_COLS})`

type U =
  { name: string | null; email: string } | { name: string | null; email: string }[] | null
const ten = (u: U) => {
  const x = Array.isArray(u) ? u[0] : u
  return x ? x.name || x.email : null
}
const so = (v: unknown) => (v == null ? null : Number(v))

type Raw = DeNghi & {
  nguoi: U
  duyet: U
  tuchoi: U
  chot: U
  lsx: { code: string } | { code: string }[] | null
  lines: (Omit<DeNghiDong, 'qty' | 'approved_qty' | 'unit_price'> & {
    qty: unknown
    approved_qty: unknown
    unit_price: unknown
  })[]
}

function unwrap(r: Raw): DeNghiDay {
  const { nguoi, duyet, tuchoi, chot, lsx, lines, ...rest } = r
  const l = Array.isArray(lsx) ? lsx[0] : lsx
  return {
    ...rest,
    requested_by_name: ten(nguoi),
    approved_by_name: ten(duyet),
    rejected_by_name: ten(tuchoi),
    closed_by_name: ten(chot),
    lsx_code: l?.code ?? null,
    lines: (lines ?? [])
      .map((x) => ({
        ...x,
        qty: Number(x.qty) || 0,
        approved_qty: so(x.approved_qty),
        unit_price: so(x.unit_price),
      }))
      .sort((a, b) => a.line_no - b.line_no),
  }
}

const ok = <T>(
  r: { data: unknown; error: { message: string } | null },
  viec: string,
): T => {
  if (r.error) throw new Error(`deNghiRepo.${viec}: ${r.error.message}`)
  return r.data as T
}

export type DongGhi = Omit<DeNghiDong, 'id' | 'line_no' | 'approved_qty' | 'po_line_id'>

export const deNghiRepo = {
  async list(): Promise<DeNghiDay[]> {
    const rows = ok<Raw[]>(
      await db()
        .from('warehouse_purchase_requests')
        .select(SEL)
        .order('created_at', { ascending: false })
        .limit(500),
      'list',
    )
    return (rows ?? []).map(unwrap)
  },

  async findById(id: string): Promise<DeNghiDay | null> {
    const r = ok<Raw | null>(
      await db()
        .from('warehouse_purchase_requests')
        .select(SEL)
        .eq('id', id)
        .maybeSingle(),
      'findById',
    )
    return r ? unwrap(r) : null
  },

  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'DNM' })
    if (error || !data) throw new Error(error?.message ?? 'Không cấp được mã đề nghị mua')
    return data as string
  },

  async insert(row: {
    code: string
    department: string
    need_by: string | null
    note: string | null
    production_order_id: string | null
    requested_by: string
    created_by: string
  }): Promise<{ id: string }> {
    return ok<{ id: string }>(
      await db().from('warehouse_purchase_requests').insert(row).select('id').single(),
      'insert',
    )
  },

  async update(
    id: string,
    patch: Partial<{
      status: DeNghiStatus
      department: string
      need_by: string | null
      note: string | null
      production_order_id: string | null
      submitted_at: string | null
      submitted_by: string | null
      cancelled_at: string | null
      cancelled_by: string | null
      cancel_reason: string | null
      approved_at: string | null
      approved_by: string | null
      rejected_at: string | null
      rejected_by: string | null
      rejected_reason: string | null
      closed_at: string | null
      closed_by: string | null
      closed_reason: string | null
    }>,
    /** Chỉ cập nhật khi phiếu còn ở trạng thái này — chặn hai người bấm cùng lúc. */
    khiDang?: DeNghiStatus[],
  ): Promise<boolean> {
    let q = db().from('warehouse_purchase_requests').update(patch).eq('id', id)
    if (khiDang) q = q.in('status', khiDang)
    const rows = ok<{ id: string }[]>(await q.select('id'), 'update')
    return (rows ?? []).length > 0
  },

  /** Số DUYỆT từng dòng (Đ2). null = duyệt đúng số đề nghị. */
  async setApprovedQty(
    rows: { id: string; approved_qty: number | null }[],
  ): Promise<void> {
    for (const r of rows)
      ok(
        await db()
          .from('warehouse_purchase_request_lines')
          .update({ approved_qty: r.approved_qty })
          .eq('id', r.id),
        'setApprovedQty',
      )
  },

  /** Thay CẢ BỘ dòng — chỉ gọi khi phiếu còn nháp (chưa dòng nào có đơn mua). */
  async replaceLines(requestId: string, lines: DongGhi[]): Promise<void> {
    ok(
      await db()
        .from('warehouse_purchase_request_lines')
        .delete()
        .eq('request_id', requestId),
      'replaceLines.delete',
    )
    if (lines.length === 0) return
    ok(
      await db()
        .from('warehouse_purchase_request_lines')
        .insert(lines.map((l, i) => ({ ...l, request_id: requestId, line_no: i + 1 }))),
      'replaceLines.insert',
    )
  },

  /** Mã · tên · ĐVT theo danh mục — dòng có mã lấy tên / ĐVT ở đây, không tin client. */
  async vatTu(
    materialIds: string[],
  ): Promise<Map<string, { code: string; name: string; unit: string }>> {
    const rows = await theoLo<{ id: string; code: string; name: string; unit: string }>(
      materialIds,
      (lo) =>
        db().from('warehouse_materials').select('id, code, name, unit').in('id', lo),
    )
    return new Map(rows.map((r) => [r.id, { code: r.code, name: r.name, unit: r.unit }]))
  },

  /**
   * ĐÃ NHẬP của từng dòng đề nghị, đọc thẳng từ SỔ KHO (0238): Σ in − Σ out các
   * dòng sổ trỏ về dòng đề nghị. Dòng đảo phiếu chép lại `purchase_request_line_id`
   * nên đảo PNK tự trừ; phiếu nhập đã bị đảo không liệt kê ở `phieu`.
   */
  async soKho(lineIds: string[]): Promise<Map<string, SoKhoDong>> {
    type R = {
      purchase_request_line_id: string
      direction: string
      qty: unknown
      unit_cost: unknown
      doc:
        | {
            id: string
            code: string
            doc_date: string
            reversal_of_doc_id: string | null
          }
        | {
            id: string
            code: string
            doc_date: string
            reversal_of_doc_id: string | null
          }[]
        | null
    }
    const rows = await theoLo<R>(lineIds, (lo) =>
      db()
        .from('warehouse_movements')
        .select(
          'purchase_request_line_id, direction, qty, unit_cost, doc:warehouse_docs!warehouse_movements_doc_id_fkey(id, code, doc_date, reversal_of_doc_id)',
        )
        .in('purchase_request_line_id', lo),
    )
    const daDao = new Set<string>()
    for (const r of rows) {
      const d = Array.isArray(r.doc) ? r.doc[0] : r.doc
      if (d?.reversal_of_doc_id) daDao.add(d.reversal_of_doc_id)
    }
    const out = new Map<string, SoKhoDong>()
    for (const r of rows) {
      const k = r.purchase_request_line_id
      const cur = out.get(k) ?? { daNhap: 0, tien: 0, phieu: [] }
      const q = Number(r.qty) || 0
      const dau = r.direction === 'in' ? 1 : -1
      cur.daNhap += dau * q
      // Dòng đảo chép unit_cost của dòng gốc (reverseDoc) nên tiền cũng tự trừ.
      if (r.unit_cost != null) cur.tien += dau * q * (Number(r.unit_cost) || 0)
      const d = Array.isArray(r.doc) ? r.doc[0] : r.doc
      if (r.direction === 'in' && d && !d.reversal_of_doc_id && !daDao.has(d.id)) {
        const p = cur.phieu.find((x) => x.doc_id === d.id)
        if (p) p.qty += q
        else cur.phieu.push({ doc_id: d.id, code: d.code, doc_date: d.doc_date, qty: q })
      }
      out.set(k, cur)
    }
    for (const v of out.values()) v.phieu.sort((a, b) => a.code.localeCompare(b.code))
    return out
  },

  /** Phiếu đang chờ duyệt, chỉ hai cột — cho số đếm menu (chạy mỗi lần mở trang). */
  async dangChoDuyet(): Promise<{ status: 'pending'; requested_by: string | null }[]> {
    return ok<{ status: 'pending'; requested_by: string | null }[]>(
      await db()
        .from('warehouse_purchase_requests')
        .select('status, requested_by')
        .eq('status', 'pending')
        .limit(1000),
      'dangChoDuyet',
    )
  },

  /** Phiếu đề nghị của các dòng — để đảo PNK biết phiếu nào phải tính lại. */
  async requestIdsOfLines(lineIds: string[]): Promise<string[]> {
    const rows = await theoLo<{ request_id: string }>(lineIds, (lo) =>
      db().from('warehouse_purchase_request_lines').select('request_id').in('id', lo),
    )
    return [...new Set(rows.map((r) => r.request_id))]
  },

  /** Kho gắn mã cho dòng "chưa có mã" lúc nhập (DN-3): tên + ĐVT theo danh mục. */
  async ganMa(
    lineId: string,
    m: { material_id: string; name: string; unit: string },
  ): Promise<void> {
    ok(
      await db()
        .from('warehouse_purchase_request_lines')
        .update(m)
        .eq('id', lineId)
        .is('material_id', null),
      'ganMa',
    )
  },

  /** Tồn dùng được (`qty_ok`) của các mã — để lãnh đạo thấy kho còn bao nhiêu. */
  async tonDungDuoc(materialIds: string[]): Promise<Map<string, number>> {
    const rows = await theoLo<{ material_id: string; qty_ok: unknown }>(
      materialIds,
      (lo) =>
        db().from('warehouse_stock').select('material_id, qty_ok').in('material_id', lo),
    )
    return new Map(rows.map((r) => [r.material_id, Number(r.qty_ok) || 0]))
  },
}
