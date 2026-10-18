import { db } from '@/server/db'
import type { DongChot, TrangThaiKy } from '@/lib/cham-cong/ky-cong'
import type { LoaiNghi } from '@/lib/cham-cong/dieu-chinh'

/** Kỳ công — bảng 0244 (hr_time_periods / team_confirms / time_results / period_events). */

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const LO = 500
const TRANG = 1000

export type KyDong = {
  id: string
  thang: string
  tu: string
  den: string
  trangThai: TrangThaiKy
  lanChot: number
  banCachTinhId: string | null
  chotLuc: string | null
  nguoiChot: string | null
  xinLyDo: string | null
  xinLuc: string | null
  xinBoi: string | null
  xinBoiId: string | null
}

export type XacNhanDong = {
  teamId: string
  to: string
  ngay0: number
  luc: string
  boi: string | null
}

export type SuKien = {
  viec: string
  to: string | null
  boi: string | null
  luc: string
  ghiChu: string | null
  data: Record<string, unknown>
}

const COT_KY = `id, period, date_from, date_to, status, close_count, calc_version_id, closed_at,
  reopen_reason, reopen_at, reopen_by,
  chot:users!hr_time_periods_closed_by_fkey(name),
  xin:users!hr_time_periods_reopen_by_fkey(name)`

type RowKy = {
  id: string
  period: string
  date_from: string
  date_to: string
  status: string
  close_count: number
  calc_version_id: string | null
  closed_at: string | null
  reopen_reason: string | null
  reopen_at: string | null
  reopen_by: string | null
  chot: { name: string } | null
  xin: { name: string } | null
}

const doiKy = (r: RowKy): KyDong => ({
  id: r.id,
  thang: r.period,
  tu: r.date_from,
  den: r.date_to,
  trangThai: r.status as TrangThaiKy,
  lanChot: r.close_count,
  banCachTinhId: r.calc_version_id,
  chotLuc: r.closed_at,
  nguoiChot: r.chot?.name ?? null,
  xinLyDo: r.reopen_reason,
  xinLuc: r.reopen_at,
  xinBoi: r.xin?.name ?? null,
  xinBoiId: r.reopen_by,
})

export const kyCongRepo = {
  async ky(thang: string): Promise<KyDong | null> {
    const r = must(
      await db().from('hr_time_periods').select(COT_KY).eq('period', thang).maybeSingle(),
    ) as unknown as RowKy | null
    return r ? doiKy(r) : null
  },

  /** Các kỳ không còn mở mà chứa một trong các ngày — để chặn ghi. */
  async kyKhoaChua(ngays: string[]): Promise<KyDong[]> {
    if (!ngays.length) return []
    const min = ngays.reduce((a, b) => (a < b ? a : b))
    const max = ngays.reduce((a, b) => (a > b ? a : b))
    const rows = must(
      await db()
        .from('hr_time_periods')
        .select(COT_KY)
        .neq('status', 'open')
        .lte('date_from', max)
        .gte('date_to', min),
    ) as unknown as RowKy[]
    return rows.map(doiKy).filter((k) => ngays.some((d) => d >= k.tu && d <= k.den))
  },

  async kyMoChua(ngay: string): Promise<KyDong | null> {
    const r = must(
      await db()
        .from('hr_time_periods')
        .select(COT_KY)
        .eq('status', 'open')
        .lte('date_from', ngay)
        .gte('date_to', ngay)
        .maybeSingle(),
    ) as unknown as RowKy | null
    return r ? doiKy(r) : null
  },

  /** Dòng kỳ sinh ở lần chuyển tiếp đầu tiên (kỳ chưa có dòng = đang mở). */
  async damBao(thang: string, tu: string, den: string): Promise<KyDong> {
    const co = await this.ky(thang)
    if (co) return co
    must(
      await db()
        .from('hr_time_periods')
        .upsert(
          { period: thang, date_from: tu, date_to: den },
          { onConflict: 'period', ignoreDuplicates: true },
        ),
    )
    return (await this.ky(thang))!
  },

  async doi(
    id: string,
    tuTrangThai: TrangThaiKy,
    patch: {
      status: TrangThaiKy
      close_count?: number
      calc_version_id?: string | null
      closed_by?: string
      closed_at?: string
      reopen_reason?: string | null
      reopen_by?: string | null
      reopen_at?: string | null
    },
  ): Promise<boolean> {
    // Đổi có điều kiện trạng thái cũ: hai người bấm cùng lúc thì chỉ một người thắng.
    const rows = must(
      await db()
        .from('hr_time_periods')
        .update(patch)
        .eq('id', id)
        .eq('status', tuTrangThai)
        .select('id'),
    )
    return rows.length === 1
  },

  async xacNhan(kyId: string): Promise<XacNhanDong[]> {
    const rows = must(
      await db()
        .from('hr_period_team_confirms')
        .select(
          `team_id, zero_days, confirmed_at,
           to:hr_teams!hr_period_team_confirms_team_id_fkey(name),
           boi:users!hr_period_team_confirms_confirmed_by_fkey(name)`,
        )
        .eq('period_id', kyId),
    )
    return rows.map((r) => ({
      teamId: r.team_id,
      to: r.to?.name ?? '',
      ngay0: r.zero_days,
      luc: r.confirmed_at,
      boi: r.boi?.name ?? null,
    }))
  },

  async ghiXacNhan(kyId: string, teamId: string, ngay0: number, userId: string) {
    must(
      await db().from('hr_period_team_confirms').upsert(
        {
          period_id: kyId,
          team_id: teamId,
          zero_days: ngay0,
          paper_signed: true,
          confirmed_by: userId,
          confirmed_at: new Date().toISOString(),
        },
        { onConflict: 'period_id,team_id' },
      ),
    )
  },

  /** Xoá xác nhận; trả số dòng đã xoá. */
  async xoaXacNhan(kyId: string, teamId: string): Promise<number> {
    const rows = must(
      await db()
        .from('hr_period_team_confirms')
        .delete()
        .eq('period_id', kyId)
        .eq('team_id', teamId)
        .select('team_id'),
    )
    return rows.length
  },

  async suKien(kyId: string): Promise<SuKien[]> {
    const rows = must(
      await db()
        .from('hr_period_events')
        .select(
          `kind, note, data, created_at,
           to:hr_teams!hr_period_events_team_id_fkey(name),
           boi:users!hr_period_events_actor_id_fkey(name)`,
        )
        .eq('period_id', kyId)
        .order('created_at', { ascending: false })
        .limit(200),
    )
    return rows.map((r) => ({
      viec: r.kind,
      to: r.to?.name ?? null,
      boi: r.boi?.name ?? null,
      luc: r.created_at,
      ghiChu: r.note,
      data: (r.data ?? {}) as Record<string, unknown>,
    }))
  },

  async ghiSuKien(e: {
    kyId: string
    viec: string
    teamId?: string | null
    userId: string | null
    ghiChu?: string | null
    data?: Record<string, unknown>
  }) {
    must(
      await db()
        .from('hr_period_events')
        .insert({
          period_id: e.kyId,
          kind: e.viec,
          team_id: e.teamId ?? null,
          actor_id: e.userId,
          note: e.ghiChu ?? null,
          data: (e.data ?? {}) as never,
        }),
    )
  },

  async ghiBanChot(
    kyId: string,
    lan: number,
    dong: (DongChot & { employeeId: string })[],
  ): Promise<void> {
    for (let i = 0; i < dong.length; i += LO)
      must(
        await db()
          .from('hr_time_results')
          .insert(
            dong.slice(i, i + LO).map((d) => ({
              period_id: kyId,
              close_no: lan,
              employee_id: d.employeeId,
              code: d.ma,
              full_name: d.ten,
              team: d.to,
              work_date: d.ngay,
              frame_minutes: d.k,
              lunch_minutes: d.truaCong,
              total_minutes: d.tong,
              leave_type: d.nghi,
              zero_day: d.khong,
              exempt: d.miem,
            })),
          ),
      )
  },

  async banChot(kyId: string, lan: number): Promise<DongChot[]> {
    const out: DongChot[] = []
    for (let a = 0; ; a += TRANG) {
      const rows = must(
        await db()
          .from('hr_time_results')
          .select(
            'code, full_name, team, work_date, frame_minutes, lunch_minutes, total_minutes, leave_type, zero_day, exempt',
          )
          .eq('period_id', kyId)
          .eq('close_no', lan)
          .order('id')
          .range(a, a + TRANG - 1),
      )
      for (const r of rows)
        out.push({
          ma: r.code,
          ten: r.full_name,
          to: r.team,
          ngay: r.work_date,
          k: (r.frame_minutes ?? {}) as Record<string, number>,
          truaCong: r.lunch_minutes,
          tong: r.total_minutes,
          nghi: r.leave_type as LoaiNghi | null,
          khong: r.zero_day,
          miem: r.exempt,
        })
      if (rows.length < TRANG) return out
    }
  },

  /** Tên tổ → id (danh mục 0242). */
  async toTheoTen(): Promise<Map<string, string>> {
    const rows = must(await db().from('hr_teams').select('id, name'))
    return new Map(rows.map((r) => [r.name, r.id]))
  },
}
