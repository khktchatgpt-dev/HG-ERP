import { db } from '@/server/db'
import type { SupplierInvoiceStatus } from './supplier-invoices.schema'

/**
 * Truy cập dữ liệu hoá đơn NCC (0188). Không có nghiệp vụ ở đây — service lo.
 *
 * `po_line_id` trên dòng hoá đơn là khoá nối của cả ba chiều (đặt / về / đòi),
 * nên hàm `invoiceLinesByPo` là đường đọc nóng nhất của module.
 */

export type SupplierInvoiceRow = {
  id: string
  supplier_id: string
  invoice_no: string
  invoice_date: string
  due_date: string | null
  currency: string
  subtotal: number
  vat_amount: number
  total: number
  status: SupplierInvoiceStatus
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SupplierInvoiceLineRow = {
  id: string
  invoice_id: string
  po_line_id: string | null
  description: string
  qty: number
  unit: string | null
  unit_price: number
  amount: number
  vat_rate: number | null
  sort_order: number
}

export type LineInput = {
  po_line_id?: string | null
  description: string
  qty: number
  unit?: string | null
  unit_price: number
  vat_rate?: number | null
}

const COLS =
  'id, supplier_id, invoice_no, invoice_date, due_date, currency, subtotal, vat_amount, total, status, note, created_by, created_at, updated_at'
const LINE_COLS =
  'id, invoice_id, po_line_id, description, qty, unit, unit_price, amount, vat_rate, sort_order'

const num = (v: unknown): number => Number(v ?? 0)
const mapRow = (r: Record<string, unknown>): SupplierInvoiceRow => ({
  ...(r as unknown as SupplierInvoiceRow),
  subtotal: num(r.subtotal),
  vat_amount: num(r.vat_amount),
  total: num(r.total),
})
const mapLine = (r: Record<string, unknown>): SupplierInvoiceLineRow => ({
  ...(r as unknown as SupplierInvoiceLineRow),
  qty: num(r.qty),
  unit_price: num(r.unit_price),
  amount: num(r.amount),
  vat_rate: r.vat_rate == null ? null : num(r.vat_rate),
})

export const supplierInvoicesRepo = {
  async list(f: {
    q?: string
    supplier_id?: string
    status?: SupplierInvoiceStatus
    page: number
    page_size: number
  }): Promise<{ rows: SupplierInvoiceRow[]; total: number }> {
    let q = db()
      .from('accounting_supplier_invoices')
      .select(COLS, { count: 'exact' })
      .order('invoice_date', { ascending: false })
    if (f.supplier_id) q = q.eq('supplier_id', f.supplier_id)
    if (f.status) q = q.eq('status', f.status)
    if (f.q) q = q.ilike('invoice_no', `%${f.q}%`)
    const from = (f.page - 1) * f.page_size
    const { data, count } = await q.range(from, from + f.page_size - 1)
    return {
      rows: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
      total: count ?? 0,
    }
  },

  async findById(id: string): Promise<SupplierInvoiceRow | null> {
    const { data } = await db()
      .from('accounting_supplier_invoices')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return data ? mapRow(data as Record<string, unknown>) : null
  },

  async linesOf(invoiceId: string): Promise<SupplierInvoiceLineRow[]> {
    const { data } = await db()
      .from('accounting_supplier_invoice_lines')
      .select(LINE_COLS)
      .eq('invoice_id', invoiceId)
      .order('sort_order')
    return (data ?? []).map((r) => mapLine(r as Record<string, unknown>))
  },

  /**
   * Mọi dòng hoá đơn đang đòi tiền các dòng của MỘT đơn mua — vế "ĐÒI" của đối
   * chiếu ba chiều. Chỉ lấy hoá đơn ĐÃ VÀO SỔ: hoá đơn nháp là thứ ai đó đang
   * gõ dở, đưa vào đối chiếu thì con số nhảy theo từng phím.
   */
  async invoiceLinesByPo(
    poLineIds: string[],
  ): Promise<
    (SupplierInvoiceLineRow & { invoice_no: string; invoice_status: string })[]
  > {
    if (poLineIds.length === 0) return []
    const { data } = await db()
      .from('accounting_supplier_invoice_lines')
      .select(LINE_COLS)
      .in('po_line_id', poLineIds)
    const lines = (data ?? []).map((r) => mapLine(r as Record<string, unknown>))
    if (lines.length === 0) return []

    /*
     * Đọc đầu hoá đơn bằng LƯỢT RIÊNG thay vì embed `!inner`.
     *
     * Embed lọc theo cột của bảng cha (`.eq('invoice.status','posted')`) là chỗ
     * dễ sai lặng: PostgREST bỏ qua điều kiện đó trong vài dạng truy vấn và trả
     * về cả hoá đơn NHÁP — tức tiền của tờ ai đó đang gõ dở lọt vào đối chiếu.
     * Lọc trong TS thì nhìn thấy được và test được. Hai lượt đọc rẻ: một đơn
     * cùng lắm vài chục dòng.
     */
    const invIds = [...new Set(lines.map((l) => l.invoice_id))]
    const { data: heads } = await db()
      .from('accounting_supplier_invoices')
      .select('id, invoice_no, status')
      .in('id', invIds)
    const byId = new Map(
      ((heads ?? []) as { id: string; invoice_no: string; status: string }[]).map((h) => [h.id, h]), // prettier-ignore
    )
    // Chỉ hoá đơn ĐÃ VÀO SỔ mới được đòi tiền trong đối chiếu — hoá đơn nháp là
    // thứ ai đó đang gõ dở, đưa vào thì con số nhảy theo từng phím.
    return lines.flatMap((l) => {
      const h = byId.get(l.invoice_id)
      return h?.status === 'posted'
        ? [{ ...l, invoice_no: h.invoice_no, invoice_status: h.status }]
        : []
    })
  },

  async insert(
    row: Omit<SupplierInvoiceRow, 'id' | 'created_at' | 'updated_at' | 'status'> & {
      status?: SupplierInvoiceStatus
    },
    lines: (LineInput & { amount: number })[],
  ): Promise<SupplierInvoiceRow> {
    const { data, error } = await db()
      .from('accounting_supplier_invoices')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Tạo hoá đơn thất bại')
    const inv = mapRow(data as Record<string, unknown>)
    await this.replaceLines(inv.id, lines)
    return inv
  },

  async patch(
    id: string,
    patch: Partial<SupplierInvoiceRow>,
  ): Promise<SupplierInvoiceRow> {
    const { data, error } = await db()
      .from('accounting_supplier_invoices')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Sửa hoá đơn thất bại')
    return mapRow(data as Record<string, unknown>)
  },

  /** Xoá sạch rồi ghi lại — dòng hoá đơn không có gì phải giữ id qua các lần sửa. */
  async replaceLines(
    invoiceId: string,
    lines: (LineInput & { amount: number })[],
  ): Promise<void> {
    await db()
      .from('accounting_supplier_invoice_lines')
      .delete()
      .eq('invoice_id', invoiceId)
    if (lines.length === 0) return
    const { error } = await db()
      .from('accounting_supplier_invoice_lines')
      .insert(
        lines.map((l, i) => ({
          invoice_id: invoiceId,
          po_line_id: l.po_line_id ?? null,
          description: l.description,
          qty: l.qty,
          unit: l.unit ?? null,
          unit_price: l.unit_price,
          amount: l.amount,
          vat_rate: l.vat_rate ?? null,
          sort_order: i,
        })),
      )
    if (error) throw new Error(error.message)
  },

  async remove(id: string): Promise<void> {
    await db().from('accounting_supplier_invoices').delete().eq('id', id)
  },
}
