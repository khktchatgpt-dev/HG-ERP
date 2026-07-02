import { db } from '@/server/db'

export type InvoiceDirection = 'incoming' | 'outgoing'
export type InvoiceStatus = 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export type Invoice = {
  id: string
  invoice_no: string
  party_name: string
  direction: InvoiceDirection
  amount: number
  currency: string
  issued_date: string
  due_date: string | null
  status: InvoiceStatus
  paid_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const COLS = 'id, invoice_no, party_name, direction, amount, currency, issued_date, due_date, status, paid_at, notes, created_by, created_at, updated_at'

export const invoicesRepo = {
  async list(filter: {
    q?: string
    direction?: InvoiceDirection
    status?: InvoiceStatus
    page: number
    page_size: number
  }): Promise<{ rows: Invoice[]; total: number; sumByCurrency: Record<string, number> }> {
    let q = db().from('accounting_invoices').select(COLS, { count: 'exact' })
      .order('issued_date', { ascending: false })
    if (filter.direction) q = q.eq('direction', filter.direction)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.q) q = q.or(`invoice_no.ilike.%${filter.q}%,party_name.ilike.%${filter.q}%`)
    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)
    const { data, count } = await q
    const rows = (data ?? []) as Invoice[]
    const sumByCurrency: Record<string, number> = {}
    for (const r of rows) {
      sumByCurrency[r.currency] = (sumByCurrency[r.currency] ?? 0) + Number(r.amount)
    }
    return { rows, total: count ?? 0, sumByCurrency }
  },

  async findById(id: string): Promise<Invoice | null> {
    const { data } = await db().from('accounting_invoices').select(COLS).eq('id', id).maybeSingle()
    return (data as Invoice | null) ?? null
  },

  async insert(row: Omit<Invoice, 'id' | 'status' | 'paid_at' | 'created_at' | 'updated_at'> & { status?: InvoiceStatus }): Promise<Invoice> {
    const { data, error } = await db().from('accounting_invoices').insert(row).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Insert invoice failed')
    return data as Invoice
  },

  async patch(id: string, patch: Partial<Invoice>): Promise<Invoice> {
    const { data, error } = await db().from('accounting_invoices').update(patch).eq('id', id).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Update invoice failed')
    return data as Invoice
  },
}
