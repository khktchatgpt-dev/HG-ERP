import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import type { SampleCondition, SampleKind, SampleStatus } from './samples.schema'

export type Sample = {
  id: string
  code: string
  kind: SampleKind
  /** null với mẫu độc lập (vật liệu/đối thủ/prototype). */
  product_id: string | null
  name: string | null
  category: string | null
  source: string | null
  status: SampleStatus
  condition: SampleCondition
  location: string | null
  acquired_at: string | null
  note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

/** Mẫu + tên hiển thị + lượt mượn đang mở (nếu có) — đủ cho 1 dòng trong bảng. */
export type SampleWithRefs = Sample & {
  /** Tên/nhóm để hiển thị: mẫu gắn SP lấy từ thư viện, mẫu độc lập lấy của chính nó. */
  display_name: string
  display_category: string | null
  /** null với mẫu độc lập. */
  product_code: string | null
  product_image_file_id: string | null
  /** null = không ai đang mượn. */
  open_loan: {
    id: string
    code: string
    borrower_name: string
    due_at: string | null
    borrowed_at: string
  } | null
}

const COLS =
  'id, code, kind, product_id, name, category, source, status, condition, location, acquired_at, note, created_by, created_at, updated_at'

type RawProduct = {
  code: string
  name: string
  category: string | null
  image_file_id: string | null
}
type RawLoan = {
  id: string
  code: string
  borrower_name: string
  due_at: string | null
  borrowed_at: string
  returned_at: string | null
}
type Raw = Sample & {
  product: RawProduct | RawProduct[] | null
  loans: RawLoan[] | null
}

/**
 * PostgREST trả embed là object hoặc array tuỳ quan hệ — pattern `unwrap` dùng ở
 * mọi repo trong dự án (xem pos.repo.ts:70).
 */
function unwrap(rows: Raw[] | null): SampleWithRefs[] {
  return (rows ?? []).map((r) => {
    const p = Array.isArray(r.product) ? r.product[0] : r.product
    // Index `technical_sample_loan_active_uniq` đảm bảo tối đa 1 lượt chưa trả.
    const open = (r.loans ?? []).find((l) => l.returned_at === null) ?? null
    return {
      ...r,
      // Mẫu gắn SP → tên/nhóm lấy từ thư viện; mẫu độc lập → của chính nó.
      display_name: r.name ?? p?.name ?? '?',
      display_category: r.category ?? p?.category ?? null,
      product_code: p?.code ?? null,
      product_image_file_id: p?.image_file_id ?? null,
      open_loan: open
        ? {
            id: open.id,
            code: open.code,
            borrower_name: open.borrower_name,
            due_at: open.due_at,
            borrowed_at: open.borrowed_at,
          }
        : null,
    }
  })
}

const SELECT =
  `${COLS}, product:technical_products(code, name, category, image_file_id),` +
  ` loans:technical_sample_loans(id, code, borrower_name, due_at, borrowed_at, returned_at)`

export const samplesRepo = {
  async nextCode(): Promise<string> {
    const { data, error } = await db().rpc('next_doc_code', { p_kind: 'MS' })
    if (error || !data) throw new Error(error?.message ?? 'next_doc_code failed')
    return data as string
  },

  async list(filter: {
    q?: string
    status?: SampleStatus
    kind?: SampleKind
    product_id?: string
    page: number
    page_size: number
  }): Promise<{ rows: SampleWithRefs[]; total: number }> {
    let query = db()
      .from('technical_samples')
      .select(SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })

    if (filter.status) query = query.eq('status', filter.status)
    if (filter.kind) query = query.eq('kind', filter.kind)
    if (filter.product_id) query = query.eq('product_id', filter.product_id)
    // Tìm theo mã mẫu HOẶC tên riêng (mẫu độc lập tra bằng tên là chính).
    if (filter.q) query = query.or(`code.ilike.%${filter.q}%,name.ilike.%${filter.q}%`)

    const from = (filter.page - 1) * filter.page_size
    query = query.range(from, from + filter.page_size - 1)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)
    return { rows: unwrap(data as unknown as Raw[]), total: count ?? 0 }
  },

  async findById(id: string): Promise<SampleWithRefs | null> {
    const { data } = await db()
      .from('technical_samples')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as unknown as Raw])[0] ?? null
  },

  async insert(row: {
    code: string
    kind: SampleKind
    product_id: string | null
    name: string | null
    category: string | null
    source: string | null
    condition: SampleCondition
    location: string | null
    acquired_at: string | null
    note: string | null
    created_by: string
  }): Promise<Sample> {
    const { data, error } = await db()
      .from('technical_samples')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'sample insert failed')
    return data as Sample
  },

  async patch(id: string, patch: Partial<Sample>): Promise<Sample> {
    const { data, error } = await db()
      .from('technical_samples')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'sample update failed')
    return data as Sample
  },

  /** Đếm mẫu theo trạng thái — cho StatsBar, gọn hơn kéo cả bảng về. */
  async countsByStatus(): Promise<Record<string, number>> {
    const { data, error } = await db().from('technical_samples').select('status')
    if (error) throw new Error(error.message)
    const out: Record<string, number> = {}
    for (const r of data ?? []) out[r.status] = (out[r.status] ?? 0) + 1
    return out
  },

  /** SP còn ít nhất 1 mẫu chưa thanh lý — để đồng bộ cờ cũ `showroom_sample`. */
  async productHasLiveSample(productId: string): Promise<boolean> {
    const { count } = await db()
      .from('technical_samples')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .neq('status', 'disposed')
    return (count ?? 0) > 0
  },

  async logEvent(row: {
    sample_id: string
    actor_id: string | null
    action:
      'created' | 'status_changed' | 'condition_changed' | 'location_changed' | 'disposed'
    /** Cột jsonb — phải là `Json` của database.types, không phải Record<string, unknown>. */
    before?: Json
    after?: Json
    note?: string | null
  }): Promise<void> {
    const { error } = await db()
      .from('technical_sample_events')
      .insert({
        sample_id: row.sample_id,
        actor_id: row.actor_id,
        action: row.action,
        before: row.before ?? {},
        after: row.after ?? {},
        note: row.note ?? null,
      })
    // Ghi log hỏng KHÔNG được làm hỏng mutation — theo activity.repo.ts:33.
    if (error) console.error('[sample_events] log failed:', error.message)
  },

  async listEvents(sampleId: string): Promise<
    {
      id: string
      actor_id: string | null
      action: string
      before: unknown
      after: unknown
      note: string | null
      created_at: string
    }[]
  > {
    const { data } = await db()
      .from('technical_sample_events')
      .select('id, actor_id, action, before, after, note, created_at')
      .eq('sample_id', sampleId)
      .order('created_at', { ascending: false })
    return data ?? []
  },
}
