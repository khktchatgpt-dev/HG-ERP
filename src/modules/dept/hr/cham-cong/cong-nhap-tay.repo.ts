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
}
