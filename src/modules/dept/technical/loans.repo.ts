import { db } from '@/server/db'
import type { BorrowerKind, SampleCondition } from './samples.schema'

export type Loan = {
  id: string
  code: string
  sample_id: string
  borrower_kind: BorrowerKind
  borrower_user_id: string | null
  borrower_customer_id: string | null
  borrower_name: string
  borrower_contact: string | null
  purpose: string | null
  borrowed_at: string
  due_at: string | null
  returned_at: string | null
  returned_condition: SampleCondition | null
  issued_by: string | null
  received_by: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export type LoanWithRefs = Loan & {
  sample_code: string
  product_name: string
}

// Phải là MỘT string literal, không nối bằng `+`: nối lại sẽ ra type `string`
// thay vì literal, và supabase-js không kiểm được select string ở tầng type nữa
// (trả GenericStringError). Cùng lý do với COLS ở các repo khác.
// prettier-ignore
const COLS = 'id, code, sample_id, borrower_kind, borrower_user_id, borrower_customer_id, borrower_name, borrower_contact, purpose, borrowed_at, due_at, returned_at, returned_condition, issued_by, received_by, note, created_at, updated_at'

type RawProduct = { name: string }
type RawSample = {
  code: string
  name: string | null
  product: RawProduct | RawProduct[] | null
}
type Raw = Loan & { sample: RawSample | RawSample[] | null }

function unwrap(rows: Raw[] | null): LoanWithRefs[] {
  return (rows ?? []).map((r) => {
    const s = Array.isArray(r.sample) ? r.sample[0] : r.sample
    const p = s ? (Array.isArray(s.product) ? s.product[0] : s.product) : null
    // Mẫu độc lập có tên riêng; mẫu gắn SP lấy tên SP từ thư viện.
    return { ...r, sample_code: s?.code ?? '?', product_name: s?.name ?? p?.name ?? '?' }
  })
}

// prettier-ignore
const SELECT = `${COLS}, sample:technical_samples(code, name, product:technical_products(name))` as const

export const loansRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'PM' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async list(filter: {
    sample_id?: string
    open_only?: boolean
    page: number
    page_size: number
  }): Promise<{ rows: LoanWithRefs[]; total: number }> {
    let query = db()
      .from('technical_sample_loans')
      .select(SELECT, { count: 'exact' })
      .order('borrowed_at', { ascending: false })

    if (filter.sample_id) query = query.eq('sample_id', filter.sample_id)
    if (filter.open_only) query = query.is('returned_at', null)

    const from = (filter.page - 1) * filter.page_size
    query = query.range(from, from + filter.page_size - 1)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)
    return { rows: unwrap(data as unknown as Raw[]), total: count ?? 0 }
  },

  async findById(id: string): Promise<Loan | null> {
    const { data } = await db()
      .from('technical_sample_loans')
      .select(COLS)
      .eq('id', id)
      .maybeSingle()
    return (data as Loan | null) ?? null
  },

  /** Lượt mượn chưa trả của 1 mẫu. Index active_uniq đảm bảo tối đa 1. */
  async findOpenBySample(sampleId: string): Promise<Loan | null> {
    const { data } = await db()
      .from('technical_sample_loans')
      .select(COLS)
      .eq('sample_id', sampleId)
      .is('returned_at', null)
      .maybeSingle()
    return (data as Loan | null) ?? null
  },

  async insert(row: {
    code: string
    sample_id: string
    borrower_kind: BorrowerKind
    borrower_user_id: string | null
    borrower_customer_id: string | null
    borrower_name: string
    borrower_contact: string | null
    purpose: string | null
    due_at: string | null
    issued_by: string
    note: string | null
  }): Promise<Loan> {
    const { data, error } = await db()
      .from('technical_sample_loans')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'loan insert failed')
    return data as Loan
  },

  async patch(id: string, patch: Partial<Loan>): Promise<Loan> {
    const { data, error } = await db()
      .from('technical_sample_loans')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'loan update failed')
    return data as Loan
  },

  /** Số lượt đang mượn quá hạn — cho StatsBar. */
  async countOverdue(today: string): Promise<number> {
    const { count } = await db()
      .from('technical_sample_loans')
      .select('id', { count: 'exact', head: true })
      .is('returned_at', null)
      .lt('due_at', today)
    return count ?? 0
  },
}
