import { db } from '@/server/db'
import type { DieuChinh, LoaiDc, LoaiNghi, TinhTrangDc } from '@/lib/cham-cong/dieu-chinh'

/** Bảng `hr_attendance_adjustments` (0240) — lớp điều chỉnh đặt lên lượt máy. */

const COT = `id, work_date, kind, punch_time, punch_dir, leave_type, reason, evidence, status,
  created_at, created_by, decided_at, decide_note, employee_id,
  emp:hr_employees!hr_attendance_adjustments_employee_id_fkey(code),
  gui:users!hr_attendance_adjustments_created_by_fkey(name),
  duyet:users!hr_attendance_adjustments_decided_by_fkey(name)`

type Dong = {
  id: string
  work_date: string
  kind: string
  punch_time: string | null
  punch_dir: string | null
  leave_type: string | null
  reason: string
  evidence: string | null
  status: string
  created_at: string
  created_by: string | null
  decided_at: string | null
  decide_note: string | null
  employee_id: string
  emp: { code: string } | null
  gui: { name: string } | null
  duyet: { name: string } | null
}

export type DieuChinhDong = DieuChinh & { employeeId: string }

function doi(r: Dong): DieuChinhDong {
  return {
    id: r.id,
    employeeId: r.employee_id,
    guiId: r.created_by,
    ma: r.emp?.code ?? '',
    ngay: r.work_date,
    loai: r.kind as LoaiDc,
    gio: r.punch_time,
    chieu: r.punch_dir as 'in' | 'out' | null,
    nghi: r.leave_type as LoaiNghi | null,
    lyDo: r.reason,
    canCu: r.evidence,
    tinhTrang: r.status as TinhTrangDc,
    nguoiGui: r.gui?.name ?? null,
    luc: r.created_at,
    nguoiDuyet: r.duyet?.name ?? null,
    lucDuyet: r.decided_at,
    ghiChuDuyet: r.decide_note,
  }
}

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

export const dieuChinhRepo = {
  /** Mọi điều chỉnh trong khoảng ngày (cả đã rút / từ chối — cho lịch sử). */
  async trongKhoang(
    tu: string,
    den: string,
    employeeId?: string,
  ): Promise<DieuChinhDong[]> {
    let q = db()
      .from('hr_attendance_adjustments')
      .select(COT)
      .gte('work_date', tu)
      .lte('work_date', den)
      .order('created_at', { ascending: true })
      .limit(5000)
    if (employeeId) q = q.eq('employee_id', employeeId)
    return (must(await q) as unknown as Dong[]).map(doi)
  },

  /** Điều chỉnh đang chờ duyệt, mọi kỳ. */
  async choDuyet(): Promise<DieuChinhDong[]> {
    const r = await db()
      .from('hr_attendance_adjustments')
      .select(COT)
      .eq('status', 'pending')
      .order('work_date', { ascending: true })
      .limit(2000)
    return (must(r) as unknown as Dong[]).map(doi)
  },

  async theoIds(ids: string[]): Promise<
    {
      id: string
      status: string
      created_by: string | null
      work_date: string
      kind: string
      nv: { code: string; full_name: string; team: string | null } | null
    }[]
  > {
    return must(
      await db()
        .from('hr_attendance_adjustments')
        .select(
          'id, status, created_by, work_date, kind, nv:hr_employees!hr_attendance_adjustments_employee_id_fkey(code, full_name, team)',
        )
        .in('id', ids),
    )
  },

  async them(row: {
    employee_id: string
    work_date: string
    kind: LoaiDc
    punch_time: string | null
    punch_dir: 'in' | 'out' | null
    leave_type: LoaiNghi | null
    reason: string
    evidence: string | null
    created_by: string
  }): Promise<string> {
    return must<{ id: string }>(
      await db().from('hr_attendance_adjustments').insert(row).select('id').single(),
    ).id
  },

  async doiTinhTrang(
    ids: string[],
    patch: {
      status: TinhTrangDc
      decided_by?: string
      decided_at?: string
      decide_note?: string | null
    },
  ): Promise<number> {
    const r = must(
      await db()
        .from('hr_attendance_adjustments')
        .update(patch)
        .in('id', ids)
        .eq('status', 'pending')
        .select('id'),
    )
    return r.length
  },
}
