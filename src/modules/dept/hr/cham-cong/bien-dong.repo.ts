import { db } from '@/server/db'
import type { Json } from '@/lib/database.types'
import type { LoaiBienDong } from '@/lib/nhan-su/bien-dong'

export type BienDongDong = {
  id: string
  employeeId: string
  loai: LoaiBienDong
  ngay: string
  lyDo: string | null
  ghiChu: string | null
  truoc: Json | null
  sau: Json | null
  nguoi: string | null
  luc: string
  huyLuc: string | null
}

/** Vết biến động nhân sự (0248). Huỷ = đánh dấu, không xoá. */
export const bienDongRepo = {
  async ghi(v: {
    employeeId: string
    loai: LoaiBienDong
    ngay: string
    lyDo?: string | null
    ghiChu?: string | null
    truoc?: unknown
    sau?: unknown
    userId: string
  }): Promise<void> {
    const { error } = await db()
      .from('hr_employee_events')
      .insert({
        employee_id: v.employeeId,
        kind: v.loai,
        effective_date: v.ngay,
        reason: v.lyDo ?? null,
        note: v.ghiChu ?? null,
        before: (v.truoc ?? null) as Json,
        after: (v.sau ?? null) as Json,
        created_by: v.userId,
      })
    if (error) throw new Error(error.message)
  },

  async cuaNguoi(employeeId: string): Promise<BienDongDong[]> {
    const { data, error } = await db()
      .from('hr_employee_events')
      .select(
        'id, employee_id, kind, effective_date, reason, note, before, after, created_at, cancelled_at, users!hr_employee_events_created_by_fkey(name)',
      )
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return (data ?? []).map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      loai: r.kind as LoaiBienDong,
      ngay: r.effective_date,
      lyDo: r.reason,
      ghiChu: r.note,
      truoc: r.before,
      sau: r.after,
      nguoi: (r.users as { name: string | null } | null)?.name ?? null,
      luc: r.created_at,
      huyLuc: r.cancelled_at,
    }))
  },

  /** Biến động còn hiệu lực mới nhất thuộc các loại cho trước. */
  async moiNhat(employeeId: string, loai: LoaiBienDong[]) {
    const { data } = await db()
      .from('hr_employee_events')
      .select('id, kind, effective_date')
      .eq('employee_id', employeeId)
      .in('kind', loai)
      .is('cancelled_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  },

  async doiNgay(id: string, ngay: string): Promise<void> {
    const { error } = await db()
      .from('hr_employee_events')
      .update({ effective_date: ngay })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },

  async huy(id: string, userId: string): Promise<void> {
    const { error } = await db()
      .from('hr_employee_events')
      .update({ cancelled_at: new Date().toISOString(), cancelled_by: userId })
      .eq('id', id)
    if (error) throw new Error(error.message)
  },
}
