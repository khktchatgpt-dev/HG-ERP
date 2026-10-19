import { db } from '@/server/db'
import type { HdNgay, LoaiHd } from '@/lib/nhan-su/hop-dong'

export type HdDong = HdNgay & {
  id: string
  employeeId: string
  so: string | null
  loai: LoaiHd
  chucDanh: string | null
  luong: number | null
  ghiChu: string | null
  fileId: string | null
  fileTen: string | null
  huyLyDo: string | null
  taoLuc: string
  nguoiTao: string | null
}

type Row = {
  id: string
  employee_id: string
  contract_no: string | null
  kind: string
  start_date: string
  end_date: string | null
  job_title: string | null
  salary: number | null
  note: string | null
  file_id: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_at: string
  f: { filename: string; deleted_at: string | null } | null
  u: { name: string | null } | null
}

const doi = (r: Row): HdDong => ({
  id: r.id,
  employeeId: r.employee_id,
  so: r.contract_no,
  loai: r.kind as LoaiHd,
  tuNgay: r.start_date,
  denNgay: r.end_date,
  huy: !!r.cancelled_at,
  chucDanh: r.job_title,
  luong: r.salary == null ? null : Number(r.salary),
  ghiChu: r.note,
  fileId: r.f && !r.f.deleted_at ? r.file_id : null,
  fileTen: r.f && !r.f.deleted_at ? r.f.filename : null,
  huyLyDo: r.cancel_reason,
  taoLuc: r.created_at,
  nguoiTao: r.u?.name ?? null,
})

/** Hợp đồng lao động (0250). Chỉ service có quyền gọi tới. */
export const hopDongRepo = {
  async cuaNguoi(employeeId: string): Promise<HdDong[]> {
    const { data, error } = await db()
      .from('hr_contracts')
      .select(
        `id, employee_id, contract_no, kind, start_date, end_date, job_title, salary, note, file_id,
         cancelled_at, cancel_reason, created_at,
         f:files!hr_contracts_file_id_fkey(filename, deleted_at),
         u:users!hr_contracts_created_by_fkey(name)`,
      )
      .eq('employee_id', employeeId)
      .order('start_date', { ascending: false })
    if (error) throw new Error(error.message)
    return ((data ?? []) as unknown as Row[]).map(doi)
  },

  async mot(id: string): Promise<HdDong | null> {
    const { data, error } = await db()
      .from('hr_contracts')
      .select(
        `id, employee_id, contract_no, kind, start_date, end_date, job_title, salary, note, file_id,
         cancelled_at, cancel_reason, created_at,
         f:files!hr_contracts_file_id_fkey(filename, deleted_at),
         u:users!hr_contracts_created_by_fkey(name)`,
      )
      .eq('id', id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    return data ? doi(data as unknown as Row) : null
  },

  /** Ngày của mọi HĐ chưa huỷ — đủ để danh sách đếm chip, không mang lương / số HĐ. */
  async ngayTatCa(): Promise<{ employeeId: string; hd: HdNgay }[]> {
    const { data, error } = await db()
      .from('hr_contracts')
      .select('employee_id, start_date, end_date')
      .is('cancelled_at', null)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      employeeId: r.employee_id,
      hd: { tuNgay: r.start_date, denNgay: r.end_date, huy: false },
    }))
  },

  /** HĐ chưa huỷ của mọi người, có loại + số — cho sổ quản lý lao động (quyền riêng tư). */
  async tatCaChuaHuy(): Promise<
    {
      employeeId: string
      so: string | null
      loai: LoaiHd
      tuNgay: string
      denNgay: string | null
      huy: false
    }[]
  > {
    const { data, error } = await db()
      .from('hr_contracts')
      .select('employee_id, contract_no, kind, start_date, end_date')
      .is('cancelled_at', null)
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      employeeId: r.employee_id,
      so: r.contract_no,
      loai: r.kind as LoaiHd,
      tuNgay: r.start_date,
      denNgay: r.end_date,
      huy: false as const,
    }))
  },

  async them(v: {
    employeeId: string
    so: string | null
    loai: LoaiHd
    tuNgay: string
    denNgay: string | null
    chucDanh: string | null
    luong: number | null
    ghiChu: string | null
    fileId: string | null
    userId: string
  }): Promise<string> {
    const { data, error } = await db()
      .from('hr_contracts')
      .insert({
        employee_id: v.employeeId,
        contract_no: v.so,
        kind: v.loai,
        start_date: v.tuNgay,
        end_date: v.denNgay,
        job_title: v.chucDanh,
        salary: v.luong,
        note: v.ghiChu,
        file_id: v.fileId,
        created_by: v.userId,
      })
      .select('id')
      .single<{ id: string }>()
    if (error) throw new Error(error.message)
    return data.id
  },

  async sua(
    id: string,
    v: Partial<{
      contract_no: string | null
      kind: LoaiHd
      start_date: string
      end_date: string | null
      job_title: string | null
      salary: number | null
      note: string | null
      file_id: string | null
    }>,
  ): Promise<void> {
    const { error } = await db().from('hr_contracts').update(v).eq('id', id)
    if (error) throw new Error(error.message)
  },

  async huy(id: string, lyDo: string, userId: string): Promise<void> {
    const { error } = await db()
      .from('hr_contracts')
      .update({
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancel_reason: lyDo,
      })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
