import { db } from '@/server/db'

/**
 * Truy cập DB của chấm công. Mọi danh sách có thể vượt 1000 dòng (người trên máy
 * ~1.000/máy, lượt quẹt ~6.000/tháng) đều đọc HẾT TRANG: PostgREST cắt ở 1000 dòng
 * mà không báo.
 */

const CO_TRANG = 1000
const LO_GHI = 1000

type Trang<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

async function docHet<T>(q: (from: number, to: number) => Trang<T>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += CO_TRANG) {
    const { data, error } = await q(from, from + CO_TRANG - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < CO_TRANG) return out
  }
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export type DeviceRow = {
  id: string
  ip: string
  port: number
  name: string
  serial: string | null
  last_pulled_at: string | null
  last_log_count: number | null
  log_capacity: number | null
  last_user_count: number | null
  last_error: string | null
  active: boolean
}

export type DeviceUserRow = {
  id: string
  device_id: string
  device_user_id: string
  name_on_device: string | null
  employee_id: string | null
  needs_review: boolean
}

export type EmployeeRow = {
  id: string
  code: string
  full_name: string
  shift_id: string
  active: boolean
  /** Bộ phận / tổ (gõ tự do, nạp từ DS tổng hợp 15/10/2026). */
  team: string | null
  note: string | null
  /** Không chấm công (Kinh Doanh, Tài Xế…): không quẹt máy, không bị tính thiếu công. */
  attendance_exempt: boolean
}

export type ShiftRow = {
  id: string
  code: string
  name: string
  start_time: string
  end_time: string
  break_minutes: number
  required_punches: number
  ot_from: string
  ot_round_minutes: number
  late_grace_minutes: number
  sort_order: number
}

export type LogRow = { device_id: string; device_user_id: string; punched_at: string }

export type PullRow = {
  id: string
  device_id: string
  date_from: string
  date_to: string
  started_at: string
  finished_at: string
  ok: boolean
  device_log_count: number | null
  logs_in_range: number | null
  logs_new: number | null
  error: string | null
  created_by: string | null
  created_by_name: string | null
}

export const chamCongRepo = {
  async devices(): Promise<DeviceRow[]> {
    return must(
      await db()
        .from('hr_attendance_devices')
        .select(
          'id, ip, port, name, serial, last_pulled_at, last_log_count, log_capacity, last_user_count, last_error, active',
        )
        .order('ip'),
    )
  },

  async updateDevice(id: string, patch: Partial<Omit<DeviceRow, 'id'>>): Promise<void> {
    must(await db().from('hr_attendance_devices').update(patch).eq('id', id))
  },

  async shifts(): Promise<ShiftRow[]> {
    return must(
      await db()
        .from('hr_shifts')
        .select(
          'id, code, name, start_time, end_time, break_minutes, required_punches, ot_from, ot_round_minutes, late_grace_minutes, sort_order',
        )
        .eq('active', true)
        .order('sort_order'),
    )
  },

  async holidays(
    from: string,
    to: string,
  ): Promise<{ holiday_date: string; name: string }[]> {
    return must(
      await db()
        .from('hr_holidays')
        .select('holiday_date, name')
        .gte('holiday_date', from)
        .lt('holiday_date', to),
    )
  },

  async employees(): Promise<EmployeeRow[]> {
    return docHet((a, b) =>
      db()
        .from('hr_employees')
        .select('id, code, full_name, shift_id, active, team, note, attendance_exempt')
        .order('code')
        .range(a, b),
    )
  },

  async insertEmployees(
    rows: { code: string; full_name: string; shift_id: string }[],
  ): Promise<EmployeeRow[]> {
    const out: EmployeeRow[] = []
    for (let i = 0; i < rows.length; i += LO_GHI) {
      out.push(
        ...must(
          await db()
            .from('hr_employees')
            .insert(rows.slice(i, i + LO_GHI))
            .select(
              'id, code, full_name, shift_id, active, team, note, attendance_exempt',
            ),
        ),
      )
    }
    return out
  },

  async updateEmployee(
    id: string,
    patch: Partial<
      Pick<
        EmployeeRow,
        'full_name' | 'team' | 'shift_id' | 'active' | 'note' | 'attendance_exempt'
      >
    >,
  ): Promise<EmployeeRow> {
    return must(
      await db()
        .from('hr_employees')
        .update(patch)
        .eq('id', id)
        .select('id, code, full_name, shift_id, active, team, note, attendance_exempt')
        .single(),
    )
  },

  async addEmployee(row: {
    code: string
    full_name: string
    shift_id: string
    team: string | null
    note: string | null
    attendance_exempt?: boolean
  }): Promise<EmployeeRow> {
    return must(
      await db()
        .from('hr_employees')
        .insert(row)
        .select('id, code, full_name, shift_id, active, team, note, attendance_exempt')
        .single(),
    )
  },

  async updateDeviceUser(
    id: string,
    patch: Pick<DeviceUserRow, 'employee_id' | 'needs_review'>,
  ): Promise<void> {
    must(await db().from('hr_device_users').update(patch).eq('id', id))
  },

  async deviceUsers(): Promise<DeviceUserRow[]> {
    return docHet((a, b) =>
      db()
        .from('hr_device_users')
        .select(
          'id, device_id, device_user_id, name_on_device, employee_id, needs_review',
        )
        .order('id')
        .range(a, b),
    )
  },

  /** Ghi (máy, mã, tên trên máy). Không đụng `employee_id` / `needs_review` đã có. */
  async upsertDeviceUsers(
    rows: { device_id: string; device_user_id: string; name_on_device: string }[],
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += LO_GHI) {
      must(
        await db()
          .from('hr_device_users')
          .upsert(rows.slice(i, i + LO_GHI), { onConflict: 'device_id,device_user_id' }),
      )
    }
  },

  async linkDeviceUsers(rows: DeviceUserRow[]): Promise<void> {
    for (let i = 0; i < rows.length; i += LO_GHI) {
      must(
        await db()
          .from('hr_device_users')
          .upsert(rows.slice(i, i + LO_GHI), { onConflict: 'id' }),
      )
    }
  },

  /** Lượt đã có (máy, mã, giờ) thì bỏ qua — chạy lại bao nhiêu lần cũng không nhân đôi. */
  async insertLogs(
    rows: {
      device_id: string
      device_user_id: string
      punched_at: string
      verify_type: number
      state: number
    }[],
  ): Promise<void> {
    for (let i = 0; i < rows.length; i += LO_GHI) {
      must(
        await db()
          .from('hr_attendance_logs')
          .upsert(rows.slice(i, i + LO_GHI), {
            onConflict: 'device_id,device_user_id,punched_at',
            ignoreDuplicates: true,
          }),
      )
    }
  },

  async countLogs(deviceId: string): Promise<number> {
    const { count, error } = await db()
      .from('hr_attendance_logs')
      .select('id', { count: 'exact', head: true })
      .eq('device_id', deviceId)
    if (error) throw new Error(error.message)
    return count ?? 0
  },

  async insertPull(row: {
    device_id: string
    created_by: string | null
    date_from: string
    date_to: string
    started_at: string
    ok: boolean
    device_log_count: number | null
    logs_in_range: number | null
    logs_new: number | null
    error: string | null
  }): Promise<void> {
    must(await db().from('hr_attendance_pulls').insert(row))
  },

  async recentPulls(limit: number): Promise<PullRow[]> {
    const rows = must(
      await db()
        .from('hr_attendance_pulls')
        .select(
          'id, device_id, date_from, date_to, started_at, finished_at, ok, device_log_count, logs_in_range, logs_new, error, created_by, nguoi:users!hr_attendance_pulls_created_by_fkey(name, email)',
        )
        .order('started_at', { ascending: false })
        .limit(limit),
    )
    return rows.map(({ nguoi, ...r }) => ({
      ...r,
      created_by_name: nguoi ? (nguoi.name ?? nguoi.email) : null,
    }))
  },

  /** Lượt của MỘT nhóm mã trên máy (một người) trong khoảng — lọc ở DB, không kéo cả công ty. */
  async logsOfCodes(codes: string[], fromIso: string, toIso: string): Promise<LogRow[]> {
    if (!codes.length) return []
    return docHet((a, b) =>
      db()
        .from('hr_attendance_logs')
        .select('device_id, device_user_id, punched_at')
        .in('device_user_id', codes)
        .gte('punched_at', fromIso)
        .lt('punched_at', toIso)
        .order('id')
        .range(a, b),
    )
  },

  /** Ngày (giờ VN) cả công ty có ít nhất 1 lượt — ngày không có là CHƯA LẤY về (0235). */
  async ngayCoLuot(fromIso: string, toIso: string): Promise<string[]> {
    const { data, error } = await db().rpc('hr_attendance_days', {
      p_from: fromIso,
      p_to: toIso,
    })
    if (error) throw new Error(error.message)
    return (data ?? []) as string[]
  },

  async logsBetween(fromIso: string, toIso: string): Promise<LogRow[]> {
    return docHet((a, b) =>
      db()
        .from('hr_attendance_logs')
        .select('device_id, device_user_id, punched_at')
        .gte('punched_at', fromIso)
        .lt('punched_at', toIso)
        .order('id')
        .range(a, b),
    )
  },
}
