import { db } from '@/server/db'
import type { CachTinh } from '@/lib/cham-cong/ky-gio-cong'

/** Sổ làm trưa + cách tính theo bộ phận (migration 0241). */

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const CO_TRANG = 1000

export const gioCongRepo = {
  /** 'ma|ngay' → phút làm trưa đã tick, trong khoảng ngày. */
  async trua(tu: string, den: string): Promise<Record<string, number>> {
    const out: Record<string, number> = {}
    for (let from = 0; ; from += CO_TRANG) {
      const rows = must(
        await db()
          .from('hr_lunch_ticks')
          .select(
            'work_date, minutes, nv:hr_employees!hr_lunch_ticks_employee_id_fkey(code)',
          )
          .gte('work_date', tu)
          .lte('work_date', den)
          .order('id')
          .range(from, from + CO_TRANG - 1),
      )
      for (const r of rows) if (r.nv) out[`${r.nv.code}|${r.work_date}`] = r.minutes
      if (rows.length < CO_TRANG) return out
    }
  },

  /** Ghi / bỏ tick làm trưa. `phut` null = bỏ tick. */
  async ghiTrua(
    muc: { employeeId: string; ngay: string; phut: number | null }[],
    userId: string,
  ): Promise<void> {
    const ghi = muc.filter((m) => m.phut != null)
    const bo = muc.filter((m) => m.phut == null)
    if (ghi.length) {
      must(
        await db()
          .from('hr_lunch_ticks')
          .upsert(
            ghi.map((m) => ({
              employee_id: m.employeeId,
              work_date: m.ngay,
              minutes: m.phut!,
              created_by: userId,
            })),
            { onConflict: 'employee_id,work_date' },
          ),
      )
    }
    for (const m of bo) {
      must(
        await db()
          .from('hr_lunch_ticks')
          .delete()
          .eq('employee_id', m.employeeId)
          .eq('work_date', m.ngay),
      )
    }
  },

  /** Tên tổ → cách tính, từ danh mục hr_teams (0242). Tổ chưa có trong danh mục = khung. */
  async cachTinh(): Promise<Record<string, CachTinh>> {
    const rows = must(await db().from('hr_teams').select('name, calc_mode'))
    return Object.fromEntries(
      rows.map((r) => [r.name, r.calc_mode === 'ngay' ? 'ngay' : 'khung']),
    )
  },

  async ghiCachTinh(team: string, mode: CachTinh, userId: string): Promise<void> {
    must(
      await db()
        .from('hr_teams')
        .upsert(
          { name: team, calc_mode: mode, updated_by: userId },
          { onConflict: 'name' },
        ),
    )
  },

  /** Mã NV → id (chỉ người đang làm). */
  async idTheoMa(codes: string[]): Promise<Map<string, string>> {
    if (!codes.length) return new Map()
    const rows = must(
      await db()
        .from('hr_employees')
        .select('id, code')
        .in('code', [...new Set(codes)].slice(0, 500)),
    )
    return new Map(rows.map((r) => [r.code, r.id]))
  },
}
