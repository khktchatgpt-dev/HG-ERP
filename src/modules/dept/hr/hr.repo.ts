import { db } from '@/server/db'

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type LeaveType = 'annual' | 'sick' | 'unpaid' | 'marriage' | 'funeral' | 'maternity' | 'other'

export type LeaveRequest = {
  id: string
  user_id: string
  leave_type: LeaveType
  from_date: string
  to_date: string
  days_count: number
  reason: string | null
  status: LeaveStatus
  approver_id: string | null
  approver_note: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export type LeaveRow = LeaveRequest & {
  user_name: string | null
  user_email: string
  approver_name: string | null
}

const COLS =
  'id, user_id, leave_type, from_date, to_date, days_count, reason, status, approver_id, approver_note, approved_at, created_at, updated_at'

type Raw = LeaveRequest & {
  user: { name: string | null; email: string } | { name: string | null; email: string }[] | null
  approver: { name: string | null } | { name: string | null }[] | null
}

function unwrap(rows: Raw[] | null): LeaveRow[] {
  return (rows ?? []).map((r) => {
    const u = Array.isArray(r.user) ? r.user[0] : r.user
    const a = Array.isArray(r.approver) ? r.approver[0] : r.approver
    return {
      ...r,
      user_name: u?.name ?? null,
      user_email: u?.email ?? '',
      approver_name: a?.name ?? null,
    }
  })
}

export const leaveRepo = {
  async list(filter: {
    user_id?: string
    status?: LeaveStatus
    page: number
    page_size: number
  }): Promise<{ rows: LeaveRow[]; total: number }> {
    let q = db().from('hr_leave_requests')
      .select(
        `${COLS},
         user:users!hr_leave_requests_user_id_fkey(name, email),
         approver:users!hr_leave_requests_approver_id_fkey(name)`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
    if (filter.user_id) q = q.eq('user_id', filter.user_id)
    if (filter.status) q = q.eq('status', filter.status)
    const from = (filter.page - 1) * filter.page_size
    const to = from + filter.page_size - 1
    q = q.range(from, to)
    const { data, count } = await q
    return { rows: unwrap(data as unknown as Raw[] | null), total: count ?? 0 }
  },

  async findById(id: string): Promise<LeaveRequest | null> {
    const { data } = await db().from('hr_leave_requests').select(COLS).eq('id', id).maybeSingle()
    return (data as LeaveRequest | null) ?? null
  },

  async insert(row: {
    user_id: string
    leave_type: LeaveType
    from_date: string
    to_date: string
    days_count: number
    reason?: string | null
  }): Promise<LeaveRequest> {
    const { data, error } = await db().from('hr_leave_requests').insert(row).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Insert leave request failed')
    return data as LeaveRequest
  },

  async patch(id: string, patch: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const { data, error } = await db().from('hr_leave_requests').update(patch).eq('id', id).select(COLS).single()
    if (error || !data) throw new Error(error?.message ?? 'Update leave failed')
    return data as LeaveRequest
  },
}
