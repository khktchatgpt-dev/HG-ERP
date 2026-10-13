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
  lsx_code: string | null
  lines: DeNghiDong[]
}

const COLS =
  'id, code, status, department, requested_by, need_by, note, production_order_id, submitted_at, approved_at, rejected_at, rejected_reason, cancelled_at, cancel_reason, created_by, created_at, updated_at'
const LINE_COLS =
  'id, line_no, material_id, name, unit, qty, approved_qty, unit_price, purpose, note, po_line_id'
const SEL = `${COLS},
  nguoi:users!warehouse_purchase_requests_requested_by_fkey(name, email),
  duyet:users!warehouse_purchase_requests_approved_by_fkey(name, email),
  tuchoi:users!warehouse_purchase_requests_rejected_by_fkey(name, email),
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
  lsx: { code: string } | { code: string }[] | null
  lines: (Omit<DeNghiDong, 'qty' | 'approved_qty' | 'unit_price'> & {
    qty: unknown
    approved_qty: unknown
    unit_price: unknown
  })[]
}

function unwrap(r: Raw): DeNghiDay {
  const { nguoi, duyet, tuchoi, lsx, lines, ...rest } = r
  const l = Array.isArray(lsx) ? lsx[0] : lsx
  return {
    ...rest,
    requested_by_name: ten(nguoi),
    approved_by_name: ten(duyet),
    rejected_by_name: ten(tuchoi),
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
