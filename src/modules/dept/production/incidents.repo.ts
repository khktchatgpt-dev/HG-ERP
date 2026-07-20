import { db } from '@/server/db'

export type Incident = {
  id: string
  production_order_id: string | null
  stage: string | null
  department_id: string | null
  reported_by: string | null
  message: string
  status: 'open' | 'resolved'
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  // Join phục vụ hiển thị — không lưu cứng.
  lsx_code: string | null
  department_name: string | null
  reported_by_name: string | null
}

const COLS =
  'id, production_order_id, stage, department_id, reported_by, message, status, resolved_by, resolved_at, created_at'

type Raw = Omit<Incident, 'lsx_code' | 'department_name' | 'reported_by_name'> & {
  lsx: { code: string } | { code: string }[] | null
  dept: { name: string } | { name: string }[] | null
  reporter: { name: string | null } | { name: string | null }[] | null
}

function unwrap(rows: Raw[] | null): Incident[] {
  return (rows ?? []).map((r) => {
    const lsx = Array.isArray(r.lsx) ? r.lsx[0] : r.lsx
    const dept = Array.isArray(r.dept) ? r.dept[0] : r.dept
    const rep = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter
    return {
      ...r,
      lsx: undefined,
      dept: undefined,
      reporter: undefined,
      lsx_code: lsx?.code ?? null,
      department_name: dept?.name ?? null,
      reported_by_name: rep?.name ?? null,
    } as unknown as Incident
  })
}

const SELECT_JOINED = `${COLS}, lsx:production_orders(code), dept:departments(name), reporter:users!production_incidents_reported_by_fkey(name)`

/** Sổ sự cố xưởng (0065) — append + resolve, không sửa nội dung. */
export const incidentsRepo = {
  async list(opts: {
    status?: 'open' | 'resolved'
    limit?: number
  }): Promise<Incident[]> {
    let q = db()
      .from('production_incidents')
      .select(SELECT_JOINED)
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 100)
    if (opts.status) q = q.eq('status', opts.status)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return unwrap(data as unknown as Raw[])
  },

  async findById(id: string): Promise<Incident | null> {
    const { data } = await db()
      .from('production_incidents')
      .select(SELECT_JOINED)
      .eq('id', id)
      .maybeSingle()
    if (!data) return null
    return unwrap([data as unknown as Raw])[0]
  },

  async insert(row: {
    production_order_id: string | null
    stage: string | null
    department_id: string | null
    reported_by: string
    message: string
  }): Promise<Incident> {
    const { data, error } = await db()
      .from('production_incidents')
      .insert(row)
      .select(SELECT_JOINED)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Insert incident failed')
    return unwrap([data as unknown as Raw])[0]
  },

  async resolve(id: string, userId: string): Promise<Incident> {
    const { data, error } = await db()
      .from('production_incidents')
      .update({
        status: 'resolved',
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(SELECT_JOINED)
      .single()
    if (error || !data) throw new Error(error?.message ?? 'Resolve incident failed')
    return unwrap([data as unknown as Raw])[0]
  },
}
