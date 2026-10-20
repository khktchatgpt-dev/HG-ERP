import { db } from '@/server/db'

/**
 * CÔNG NỢ NCC (GĐ C.1 — plan-ke-toan-cong-no-ncc): phát sinh KHÔNG lưu cứng —
 * đọc từ movements NHẬN CÓ GIÁ (0161 Kho thấy giá) join ngược PO → NCC;
 * phiếu đảo (movement `out` mang po_line_id) tự cấn trừ bằng dấu âm.
 * Bảng duy nhất của riêng kế toán là sổ THANH TOÁN (0167).
 */

/** 1 movement nhận/đảo có giá, đã kèm ngữ cảnh PO + NCC. */
export type ReceiptValueRow = {
  qty: number
  unit_cost: number
  direction: 'in' | 'out'
  created_at: string
  doc_code: string | null
  doc_date: string | null
  supplier_doc_no: string | null
  po_id: string
  po_code: string
  currency: string
  supplier_id: string
  supplier_name: string
  payment_terms: string | null
}

export type SupplierPayment = {
  id: string
  supplier_id: string
  po_id: string | null
  amount: number
  currency: string
  paid_on: string
  method: string | null
  ref_no: string | null
  note: string | null
  created_by: string | null
  created_at: string
  created_by_name: string | null
  po_code: string | null
}

const MOVE_SELECT =
  'qty, unit_cost, direction, created_at, doc:warehouse_docs(code, doc_date, supplier_doc_no), line:supply_purchase_order_lines(po_id, po:supply_purchase_orders(id, code, currency, supplier_id, supplier:supply_suppliers(name, short_name, payment_terms)))'

type One<T> = T | T[] | null
const first = <T>(v: One<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v)

type RawMove = {
  qty: unknown
  unit_cost: unknown
  direction: string
  created_at: string
  doc: One<{ code: string; doc_date: string; supplier_doc_no: string | null }>
  line: One<{
    po_id: string
    po: One<{
      id: string
      code: string
      currency: string
      supplier_id: string
      supplier: One<{
        name: string
        short_name: string | null
        payment_terms: string | null
      }>
    }>
  }>
}

function unwrapMoves(rows: RawMove[] | null): ReceiptValueRow[] {
  const out: ReceiptValueRow[] = []
  for (const r of rows ?? []) {
    const line = first(r.line)
    const po = line ? first(line.po) : null
    if (!po) continue
    const supplier = first(po.supplier)
    const doc = first(r.doc)
    out.push({
      qty: Number(r.qty),
      unit_cost: Number(r.unit_cost),
      direction: r.direction === 'out' ? 'out' : 'in',
      created_at: r.created_at,
      doc_code: doc?.code ?? null,
      doc_date: doc?.doc_date ?? null,
      supplier_doc_no: doc?.supplier_doc_no ?? null,
      po_id: po.id,
      po_code: po.code,
      currency: po.currency,
      supplier_id: po.supplier_id,
      supplier_name: supplier?.short_name || supplier?.name || '?',
      payment_terms: supplier?.payment_terms ?? null,
    })
  }
  return out
}

const PAY_SELECT =
  'id, supplier_id, po_id, amount, currency, paid_on, method, ref_no, note, created_by, created_at, actor:users(name), po:supply_purchase_orders(code)'

type RawPay = Omit<SupplierPayment, 'created_by_name' | 'po_code'> & {
  actor: One<{ name: string | null }>
  po: One<{ code: string }>
}

function unwrapPays(rows: RawPay[] | null): SupplierPayment[] {
  return (rows ?? []).map((r) => ({
    ...r,
    actor: undefined,
    po: undefined,
    amount: Number(r.amount),
    created_by_name: first(r.actor)?.name ?? null,
    po_code: first(r.po)?.code ?? null,
  })) as unknown as SupplierPayment[]
}

export const payablesRepo = {
  /** Mọi movement CÓ GIÁ gắn dòng PO — nguyên liệu tính phát sinh. */
  async receiptValues(): Promise<ReceiptValueRow[]> {
    const { data } = await db()
      .from('warehouse_movements')
      .select(MOVE_SELECT)
      .not('po_line_id', 'is', null)
      .not('unit_cost', 'is', null)
      .limit(50000)
    return unwrapMoves(data as unknown as RawMove[] | null)
  },

  /**
   * TẠM TÍNH theo ĐƠN NCC ĐÃ XÁC NHẬN — cơ sở thay thế, KHÔNG phải công nợ thật.
   *
   * Vì sao có: sổ công nợ đúng đắn tính theo phiếu nhập kho, nhưng Kho chưa ghi
   * nhận phiếu nào (đo 11/09/2026: 0 phiếu nhập gắn đơn có giá ngoài dữ liệu
   * thử). Kết quả là công nợ ra 0 trong khi đã cam kết 5,68 tỷ, và Kế toán
   * không có gì để nhìn. Cơ sở này cho họ một con số ƯỚC TÍNH trong lúc chờ Kho
   * vào nhịp — màn hình BẮT BUỘC nói rõ đang xem theo cơ sở nào.
   *
   * ⚠ KHÔNG ghi sổ theo số này. Nợ phải trả phát sinh khi hàng về hoặc khi có
   * hoá đơn; NCC gật đầu chưa phải là nợ.
   *
   * Trả về ĐÚNG hình dạng `ReceiptValueRow` để dùng lại `summarizePayables`
   * (đã có test: tách tiền tệ, trừ đã trả). `qty = 1` và `unit_cost = tiền cả
   * dòng` vì tiền của dòng phụ thuộc `price_basis`/`qty2` — nhân lại qty × giá
   * ở đây là dựng nguồn số thứ hai.
   */
  async confirmedPoValues(): Promise<ReceiptValueRow[]> {
    const { data } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'qty_ordered, unit_price, price_basis, qty2, po:supply_purchase_orders!inner(id, code, currency, status, created_at, supplier_id, supplier:supply_suppliers(name, short_name, payment_terms))',
      )
      .limit(50000)
    type Raw = {
      qty_ordered: unknown
      unit_price: unknown
      price_basis: 'unit' | 'unit2'
      qty2: unknown
      po: {
        id: string
        code: string
        currency: string
        status: string
        created_at: string
        supplier_id: string
        supplier: { name: string; short_name: string | null; payment_terms: string | null } | null // prettier-ignore
      } | null
    }
    const CONFIRMED_ON = ['confirmed', 'in_transit', 'partial', 'received']
    const out: ReceiptValueRow[] = []
    for (const r of (data ?? []) as unknown as Raw[]) {
      const po = Array.isArray(r.po) ? r.po[0] : r.po
      if (!po || !CONFIRMED_ON.includes(po.status)) continue
      const price = r.unit_price == null ? 0 : Number(r.unit_price)
      const amount =
        r.price_basis === 'unit2' && r.qty2 != null
          ? Number(r.qty2) * price
          : Number(r.qty_ordered ?? 0) * price
      if (!(amount > 0)) continue
      out.push({
        qty: 1,
        unit_cost: Math.round(amount * 100) / 100,
        direction: 'in',
        created_at: po.created_at,
        doc_code: po.code,
        doc_date: po.created_at.slice(0, 10),
        supplier_doc_no: null,
        po_id: po.id,
        po_code: po.code,
        currency: po.currency || 'VND',
        supplier_id: po.supplier_id,
        supplier_name: po.supplier?.short_name || po.supplier?.name || '—',
        payment_terms: po.supplier?.payment_terms ?? null,
      })
    }
    return out
  },

  /**
   * Movement nhận gắn PO nhưng THIẾU GIÁ — phát sinh đang bị đếm hụt.
   * Trả per NCC để màn cảnh báo "n phiếu chưa có giá" thay vì ra số 0 im lặng.
   */
  async receiptsMissingPrice(): Promise<
    { supplier_id: string; supplier_name: string; count: number }[]
  > {
    const { data } = await db()
      .from('warehouse_movements')
      .select(
        'id, line:supply_purchase_order_lines(po:supply_purchase_orders(supplier_id, supplier:supply_suppliers(name, short_name)))',
      )
      .not('po_line_id', 'is', null)
      .is('unit_cost', null)
      .eq('direction', 'in')
      .limit(10000)
    const byId = new Map<
      string,
      { supplier_id: string; supplier_name: string; count: number }
    >()
    type Raw = {
      line: One<{
        po: One<{
          supplier_id: string
          supplier: One<{ name: string; short_name: string | null }>
        }>
      }>
    }
    for (const r of (data ?? []) as unknown as Raw[]) {
      const po = first(first(r.line)?.po ?? null)
      if (!po) continue
      const cur = byId.get(po.supplier_id) ?? {
        supplier_id: po.supplier_id,
        supplier_name: first(po.supplier)?.short_name || first(po.supplier)?.name || '?',
        count: 0,
      }
      cur.count += 1
      byId.set(po.supplier_id, cur)
    }
    return [...byId.values()]
  },

  async listPayments(supplierId?: string): Promise<SupplierPayment[]> {
    let q = db()
      .from('accounting_supplier_payments')
      .select(PAY_SELECT)
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5000)
    if (supplierId) q = q.eq('supplier_id', supplierId)
    const { data } = await q
    return unwrapPays(data as unknown as RawPay[] | null)
  },

  async findPayment(id: string): Promise<SupplierPayment | null> {
    const { data } = await db()
      .from('accounting_supplier_payments')
      .select(PAY_SELECT)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrapPays([data as unknown as RawPay])[0]
  },

  async insertPayment(row: {
    supplier_id: string
    po_id: string | null
    amount: number
    currency: string
    paid_on: string
    method: string | null
    ref_no: string | null
    note: string | null
    created_by: string
  }): Promise<void> {
    const { error } = await db().from('accounting_supplier_payments').insert(row)
    if (error) throw new Error(error.message)
  },

  async deletePayment(id: string): Promise<void> {
    const { error } = await db()
      .from('accounting_supplier_payments')
      .delete()
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  /** NCC của 1 PO — kiểm "PO thuộc đúng NCC" khi ghi thanh toán gắn PO. */
  async poSupplier(poId: string): Promise<string | null> {
    const { data } = await db()
      .from('supply_purchase_orders')
      .select('supplier_id')
      .eq('id', poId)
      .maybeSingle()
    return (data as { supplier_id: string } | null)?.supplier_id ?? null
  },
}
