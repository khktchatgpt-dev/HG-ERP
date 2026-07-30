import { db } from '@/server/db'

export type Customer = {
  id: string
  code: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  owner_id: string | null
  tax_code: string | null
  country: string | null
  contact_person: string | null
  default_currency: string | null
  default_price_term: string | null
  default_payment_terms: string | null
  port_of_discharge: string | null
  fax: string | null
  representative_title: string | null
  fsc_cert: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type CustomerWithOwner = Customer & {
  owner_name: string | null
  owner_email: string | null
}

const COLS =
  'id, code, name, email, phone, address, notes, owner_id, tax_code, country, contact_person, default_currency, default_price_term, default_payment_terms, port_of_discharge, fax, representative_title, fsc_cert, is_active, created_at, updated_at'

/**
 * `active` = đang giao dịch, `inactive` = đã ngừng, `all` = cả hai.
 *
 * Trước đây danh sách KH cứng `active_only: true`, nên KH vừa bị đánh "ngừng giao
 * dịch" là MẤT HẲN khỏi giao diện: không xem lại được, cũng không bật lại được.
 */
export type CustomerStatusFilter = 'all' | 'active' | 'inactive'

export type ListFilter = {
  q?: string
  owner_id?: string
  /** Chỉ KH CHƯA gán phụ trách. Loại trừ với `owner_id`. */
  unassigned?: boolean
  status: CustomerStatusFilter
  page: number
  page_size: number
}

/** Số dùng cho StatsBar của danh sách KH. */
export type CustomerCounts = {
  total: number
  active: number
  inactive: number
  unassigned: number
}

/** Số báo giá / đơn của một KH — cột "hoạt động" ở danh sách. */
export type CustomerActivity = {
  quotes: number
  orders: number
  /** Đơn chưa giao và chưa huỷ. */
  openOrders: number
}

type RawJoin = Customer & {
  owner:
    | { name: string | null; email: string }
    | { name: string | null; email: string }[]
    | null
}

function unwrapOwner(rows: RawJoin[] | null): CustomerWithOwner[] {
  return (rows ?? []).map((r) => {
    const o = Array.isArray(r.owner) ? r.owner[0] : r.owner
    return {
      ...r,
      owner_name: o?.name ?? null,
      owner_email: o?.email ?? null,
    }
  })
}

/**
 * Trong biểu thức `or(...)` của PostgREST, dấu phẩy tách điều kiện và ngoặc gom
 * nhóm. Từ khoá chứa mấy ký tự đó (vd "Công ty A, B") sẽ làm câu lọc vỡ thành
 * điều kiện rác → 400. Bỏ chúng đi: ký tự bị bỏ vẫn khớp nhờ `%…%` hai đầu.
 */
function escapeOrValue(v: string): string {
  return v.replace(/[,()]/g, ' ').trim()
}

export const customersRepo = {
  async list(filter: ListFilter): Promise<{ rows: CustomerWithOwner[]; total: number }> {
    let q = db()
      .from('sales_customers')
      .select(`${COLS}, owner:users!sales_customers_owner_id_fkey(name, email)`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })

    if (filter.status !== 'all') q = q.eq('is_active', filter.status === 'active')
    if (filter.unassigned) q = q.is('owner_id', null)
    else if (filter.owner_id) q = q.eq('owner_id', filter.owner_id)
    if (filter.q) {
      // Sale tra KH bằng bất cứ thứ gì đang có trong tay: tên, mã, email, tên
      // người liên hệ, số điện thoại, mã số thuế, quốc gia. Trước chỉ 3 cột đầu
      // nên gõ tên người liên hệ hay số điện thoại đều ra 0 kết quả.
      const like = `%${escapeOrValue(filter.q)}%`
      q = q.or(
        [
          `name.ilike.${like}`,
          `code.ilike.${like}`,
          `email.ilike.${like}`,
          `contact_person.ilike.${like}`,
          `phone.ilike.${like}`,
          `tax_code.ilike.${like}`,
          `country.ilike.${like}`,
        ].join(','),
      )
    }

    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)

    const { data, count } = await q
    return { rows: unwrapOwner(data as unknown as RawJoin[] | null), total: count ?? 0 }
  },

  async findById(id: string): Promise<CustomerWithOwner | null> {
    const { data } = await db()
      .from('sales_customers')
      .select(`${COLS}, owner:users!sales_customers_owner_id_fkey(name, email)`)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrapOwner([data as unknown as RawJoin])[0]
  },

  /**
   * Mã KH đã có ai dùng chưa. DB có unique index `sales_customers_code_key` nên
   * không kiểm ở đây thì người dùng nhận 500 kèm thông báo Postgres thô thay vì
   * "mã đã tồn tại". `exceptId` để lúc sửa không tự tố chính mình.
   */
  async existsByCode(code: string, exceptId?: string): Promise<boolean> {
    let q = db()
      .from('sales_customers')
      .select('id', { count: 'exact', head: true })
      .eq('code', code)
    if (exceptId) q = q.neq('id', exceptId)
    const { count } = await q
    return (count ?? 0) > 0
  },

  /** Số cho StatsBar — 2 cột nhẹ, đếm ở app (bảng KH nhỏ: hàng chục–trăm dòng). */
  async counts(): Promise<CustomerCounts> {
    const { data } = await db().from('sales_customers').select('is_active, owner_id')
    const rows = (data ?? []) as { is_active: boolean; owner_id: string | null }[]
    return {
      total: rows.length,
      active: rows.filter((r) => r.is_active).length,
      inactive: rows.filter((r) => !r.is_active).length,
      unassigned: rows.filter((r) => r.owner_id == null).length,
    }
  },

  /**
   * Số báo giá / đơn theo KH cho ĐÚNG các KH đang hiện trên trang.
   *
   * Hai query 2 cột thay vì n+1 lượt đếm. Nếu về sau đơn hàng lên hàng chục nghìn
   * dòng thì chuyển sang RPC gộp (như `technical_product_counts`) — hiện chưa cần.
   */
  async activityByCustomers(ids: string[]): Promise<Record<string, CustomerActivity>> {
    const out: Record<string, CustomerActivity> = {}
    if (ids.length === 0) return out
    for (const id of ids) out[id] = { quotes: 0, orders: 0, openOrders: 0 }

    const [quotes, orders] = await Promise.all([
      db().from('sales_quotes').select('customer_id').in('customer_id', ids),
      db().from('sales_orders').select('customer_id, status').in('customer_id', ids),
    ])
    for (const r of (quotes.data ?? []) as { customer_id: string }[]) {
      if (out[r.customer_id]) out[r.customer_id].quotes++
    }
    for (const r of (orders.data ?? []) as { customer_id: string; status: string }[]) {
      const a = out[r.customer_id]
      if (!a) continue
      a.orders++
      if (r.status !== 'delivered' && r.status !== 'cancelled') a.openOrders++
    }
    return out
  },

  /**
   * Báo giá / đơn đang trỏ vào KH này. Cả hai FK là `on delete restrict` (xem
   * 0002/0006), nên xoá KH có lịch sử sẽ bị Postgres chặn giữa đường — phải đếm
   * TRƯỚC để nói cho người dùng biết và mời họ dùng "Ngừng giao dịch".
   */
  async usageCounts(id: string): Promise<{ quotes: number; orders: number }> {
    const [quotes, orders] = await Promise.all([
      db()
        .from('sales_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', id),
      db()
        .from('sales_orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', id),
    ])
    return { quotes: quotes.count ?? 0, orders: orders.count ?? 0 }
  },

  async insert(
    row: Omit<Customer, 'id' | 'created_at' | 'updated_at' | 'is_active'> & {
      is_active?: boolean
    },
  ): Promise<Customer> {
    const { data, error } = await db()
      .from('sales_customers')
      .insert(row)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert customer failed')
    return data as Customer
  },

  async patch(id: string, patch: Partial<Customer>): Promise<Customer> {
    const { data, error } = await db()
      .from('sales_customers')
      .update(patch)
      .eq('id', id)
      .select(COLS)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Update customer failed')
    return data as Customer
  },

  async delete(id: string): Promise<void> {
    const { error } = await db().from('sales_customers').delete().eq('id', id)
    if (error) throw new Error(error.message)
  },
}
