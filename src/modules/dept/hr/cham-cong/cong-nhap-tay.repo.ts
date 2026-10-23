import { db } from '@/server/db'

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

/** Một dòng công nhập tay khối A (kind 'exempt') của một kỳ. */
export type NhapTayDong = {
  employeeId: string
  cong: number
  tcPhut: number
  ghiChu: string | null
  nguoiSua: string | null
  lucSua: string
}

/** Một dòng công cộng thêm khối B (kind 'extra'); một người có thể nhiều dòng. */
export type CongThemDong = {
  id: string
  employeeId: string
  cong: number
  lyDo: string | null
  ghiChu: string | null
  nguoiSua: string | null
  lucSua: string
}

/** hr_time_manual (0262) — công người không chấm công do Nhân sự nhập, một dòng / người / kỳ. */
export const congNhapTayRepo = {
  async ds(thang: string): Promise<NhapTayDong[]> {
    const rows = must(
      await db()
        .from('hr_time_manual')
        .select(
          'employee_id, work_days, ot_minutes, note, updated_at, nguoi:users!hr_time_manual_updated_by_fkey(name)',
        )
        .eq('period', thang)
        .eq('kind', 'exempt'),
    )
    return rows.map((r) => ({
      employeeId: r.employee_id,
      cong: Number(r.work_days),
      tcPhut: r.ot_minutes,
      ghiChu: r.note,
      nguoiSua: r.nguoi?.name ?? null,
      lucSua: r.updated_at,
    }))
  },

  async ghi(v: {
    thang: string
    employeeId: string
    cong: number
    tcPhut: number
    ghiChu: string | null
    userId: string
  }): Promise<void> {
    const co = must(
      await db()
        .from('hr_time_manual')
        .select('id')
        .eq('period', v.thang)
        .eq('kind', 'exempt')
        .eq('employee_id', v.employeeId)
        .maybeSingle(),
    ) as { id: string } | null
    const gia = {
      work_days: v.cong,
      ot_minutes: v.tcPhut,
      note: v.ghiChu,
      updated_by: v.userId,
    }
    if (co) must(await db().from('hr_time_manual').update(gia).eq('id', co.id))
    else
      must(
        await db()
          .from('hr_time_manual')
          .insert({
            ...gia,
            period: v.thang,
            employee_id: v.employeeId,
            kind: 'exempt',
            created_by: v.userId,
          }),
      )
  },

  async xoa(thang: string, employeeId: string): Promise<void> {
    must(
      await db()
        .from('hr_time_manual')
        .delete()
        .eq('period', thang)
        .eq('kind', 'exempt')
        .eq('employee_id', employeeId),
    )
  },

  async dsThem(thang: string): Promise<CongThemDong[]> {
    const rows = must(
      await db()
        .from('hr_time_manual')
        .select(
          'id, employee_id, work_days, reason, note, updated_at, nguoi:users!hr_time_manual_updated_by_fkey(name)',
        )
        .eq('period', thang)
        .eq('kind', 'extra')
        .order('created_at'),
    )
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      cong: Number(r.work_days),
      lyDo: r.reason,
      ghiChu: r.note,
      nguoiSua: r.nguoi?.name ?? null,
      lucSua: r.updated_at,
    }))
  },

  /** Thêm nhiều dòng một lượt (dán từ Excel) hoặc một dòng. */
  async themNhieu(
    thang: string,
    ds: { employeeId: string; cong: number; lyDo: string; ghiChu: string | null }[],
    userId: string,
  ): Promise<void> {
    if (!ds.length) return
    must(
      await db()
        .from('hr_time_manual')
        .insert(
          ds.map((x) => ({
            period: thang,
            employee_id: x.employeeId,
            kind: 'extra',
            work_days: x.cong,
            ot_minutes: 0,
            reason: x.lyDo,
            note: x.ghiChu,
            created_by: userId,
            updated_by: userId,
          })),
        ),
    )
  },

  async suaThem(
    id: string,
    thang: string,
    v: { employeeId: string; cong: number; lyDo: string; ghiChu: string | null },
    userId: string,
  ): Promise<boolean> {
    const rows = must(
      await db()
        .from('hr_time_manual')
        .update({
          employee_id: v.employeeId,
          work_days: v.cong,
          reason: v.lyDo,
          note: v.ghiChu,
          updated_by: userId,
        })
        .eq('id', id)
        .eq('period', thang)
        .eq('kind', 'extra')
        .select('id'),
    )
    return rows.length > 0
  },

  async xoaThem(id: string, thang: string): Promise<void> {
    must(
      await db()
        .from('hr_time_manual')
        .delete()
        .eq('id', id)
        .eq('period', thang)
        .eq('kind', 'extra'),
    )
  },
}
