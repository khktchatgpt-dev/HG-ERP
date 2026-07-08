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

export type ListFilter = {
  q?: string
  owner_id?: string
  active_only: boolean
  page: number
  page_size: number
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

export const customersRepo = {
  async list(filter: ListFilter): Promise<{ rows: CustomerWithOwner[]; total: number }> {
    let q = db()
      .from('sales_customers')
      .select(`${COLS}, owner:users!sales_customers_owner_id_fkey(name, email)`, {
        count: 'exact',
      })
      .order('created_at', { ascending: false })

    if (filter.active_only) q = q.eq('is_active', true)
    if (filter.owner_id) q = q.eq('owner_id', filter.owner_id)
    if (filter.q) {
      const like = `%${filter.q}%`
      q = q.or(`name.ilike.${like},code.ilike.${like},email.ilike.${like}`)
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
