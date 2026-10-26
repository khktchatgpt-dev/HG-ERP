import { db } from '@/server/db'
import type { KhungBan, QuyTac } from '@/lib/cham-cong/cach-tinh'
import type { KieuLamTronRa } from '@/lib/cham-cong/gio-khung'
import { cachTinhCua, type CachTinh } from '@/lib/cham-cong/ky-gio-cong'

/** Bản cách tính công — bảng 0243 (hr_calc_versions / frames / rates). */

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data as T
}

const COT_BAN = `id, version_no, from_period, status, lunch_from, lunch_to, grace_minutes,
  round_out_mode, half_threshold, full_threshold, round_in_afternoon, round_in_evening, count_early, early_from,
  night_before, minutes_per_cong, lunch_factor, lunch_default_minutes, note, created_at,
  updated_at, applied_at,
  tao:users!hr_calc_versions_created_by_fkey(name),
  sua:users!hr_calc_versions_updated_by_fkey(name),
  ad:users!hr_calc_versions_applied_by_fkey(name)`

type DongBan = {
  id: string
  version_no: number
  from_period: string | null
  status: string
  lunch_from: number
  lunch_to: number
  grace_minutes: number
  round_out_mode: string
  half_threshold: number
  full_threshold: number
  round_in_afternoon: boolean
  round_in_evening: boolean
  count_early: boolean
  early_from: number
  night_before: number
  minutes_per_cong: number
  lunch_factor: number
  lunch_default_minutes: number
  note: string | null
  created_at: string
  updated_at: string
  applied_at: string | null
  tao: { name: string } | null
  sua: { name: string } | null
  ad: { name: string } | null
}

export type BanDong = {
  id: string
  so: number
  tuKy: string | null
  quyTac: QuyTac
  ghiChu: string | null
  taoLuc: string
  nguoiTao: string | null
  suaLuc: string
  nguoiSua: string | null
  apDungLuc: string | null
  nguoiApDung: string | null
}

export type ThamSoLuong = {
  /** Công chuẩn cố định (KT: 26); null = đếm ngày kỳ trừ CN, lễ. */
  congChuan: number | null
  /** % trả giờ giải lao; null = cộng vào hành chính như chốt công. */
  ptTrua: number | null
  /** Trừ thuế TNCN trên bảng lương. */
  truThue: boolean
}

export type HeSoDong = {
  loai: 'frame' | 'leave'
  ma: string
  ngay: 'thuong' | 'cn' | 'le' | 'any'
  pt: number | null
  lyDo: string | null
}

function doiBan(r: DongBan): BanDong {
  return {
    id: r.id,
    so: r.version_no,
    tuKy: r.status === 'applied' ? r.from_period : null,
    quyTac: {
      truaTu: r.lunch_from,
      truaDen: r.lunch_to,
      anHanPhut: r.grace_minutes,
      lamTronRaKieu: r.round_out_mode as KieuLamTronRa,
      nguongNuaGio: r.half_threshold,
      nguongDuGio: r.full_threshold,
      lamTronVaoChieu: r.round_in_afternoon,
      lamTronVaoToi: r.round_in_evening,
      tinhDenSom: r.count_early,
      denSomTu: r.early_from,
      caDemDen: r.night_before,
      phutMotCong: r.minutes_per_cong,
      heSoTrua: Number(r.lunch_factor),
      phutTruaMacDinh: r.lunch_default_minutes,
    },
    ghiChu: r.note,
    taoLuc: r.created_at,
    nguoiTao: r.tao?.name ?? null,
    suaLuc: r.updated_at,
    nguoiSua: r.sua?.name ?? null,
    apDungLuc: r.applied_at,
    nguoiApDung: r.ad?.name ?? null,
  }
}

const cotQuyTac = (q: QuyTac) => ({
  lunch_from: q.truaTu,
  lunch_to: q.truaDen,
  grace_minutes: q.anHanPhut,
  round_out_mode: q.lamTronRaKieu,
  half_threshold: q.nguongNuaGio,
  full_threshold: q.nguongDuGio,
  round_in_afternoon: q.lamTronVaoChieu,
  round_in_evening: q.lamTronVaoToi,
  count_early: q.tinhDenSom,
  early_from: q.denSomTu,
  night_before: q.caDemDen,
  minutes_per_cong: q.phutMotCong,
  lunch_factor: q.heSoTrua,
  lunch_default_minutes: q.phutTruaMacDinh,
})

export const cachTinhRepo = {
  async dsBan(): Promise<BanDong[]> {
    const rows = must(
      await db().from('hr_calc_versions').select(COT_BAN).order('version_no'),
    ) as unknown as DongBan[]
    return rows.map(doiBan)
  },

  async khung(banId: string): Promise<KhungBan[]> {
    const rows = must(
      await db()
        .from('hr_calc_frames')
        .select(
          'code, name, from_minute, to_minute, drop_remainder, is_office, night_shift',
        )
        .eq('version_id', banId)
        .order('from_minute'),
    )
    return (
      rows
        .map((r) => ({
          ma: r.code,
          ten: r.name,
          tu: r.from_minute,
          den: r.to_minute,
          boPhanLo: r.drop_remainder,
          hanhChinh: r.is_office,
          caDem: r.night_shift,
        }))
        // Khung ca đêm đứng cuối danh sách (ngoài chuỗi 24 giờ) dù giờ bắt đầu nằm giữa.
        .sort((a, b) => Number(a.caDem) - Number(b.caDem))
    )
  },

  async heSo(banId: string): Promise<HeSoDong[]> {
    const rows = must(
      await db()
        .from('hr_calc_rates')
        .select('kind, code, day_kind, percent, below_law_reason')
        .eq('version_id', banId),
    )
    return rows.map((r) => ({
      loai: r.kind as HeSoDong['loai'],
      ma: r.code,
      ngay: r.day_kind as HeSoDong['ngay'],
      pt: r.percent == null ? null : Number(r.percent),
      lyDo: r.below_law_reason,
    }))
  },

  /**
   * Tham số LƯƠNG của bản (0254) — đọc riêng, không thuộc quy tắc chấm công nên màn Cách tính
   * công không phải biết tới. Sửa trên giao diện: bước sau (cần bản vẽ).
   */
  async thamSoLuong(banId: string): Promise<ThamSoLuong> {
    const r = must(
      await db()
        .from('hr_calc_versions')
        .select('standard_days, lunch_pay_percent, withhold_tax')
        .eq('id', banId)
        .single<{
          standard_days: number | null
          lunch_pay_percent: number | null
          withhold_tax: boolean
        }>(),
    )
    if (!r) throw new Error('Không thấy bản cách tính')
    return {
      congChuan: r.standard_days,
      ptTrua: r.lunch_pay_percent == null ? null : Number(r.lunch_pay_percent),
      truThue: r.withhold_tax,
    }
  },

  /** Bản mới (nháp) chép từ `goc`: quy tắc + khung + hệ số. */
  async taoTu(goc: BanDong, khung: KhungBan[], heSo: HeSoDong[], userId: string) {
    const so = (await this.dsBan()).reduce((m, b) => Math.max(m, b.so), 0) + 1
    const ban = must(
      await db()
        .from('hr_calc_versions')
        .insert({
          version_no: so,
          status: 'draft',
          ...cotQuyTac(goc.quyTac),
          note: `Chép từ Bản ${goc.so}`,
          created_by: userId,
          updated_by: userId,
        })
        .select('id')
        .single<{ id: string }>(),
    )
    if (!ban) throw new Error('Không tạo được bản cách tính')
    // Tham số lương đi theo bản gốc — bỏ sót là bản mới mất công chuẩn 26 / giải lao 210 %.
    const ts = await this.thamSoLuong(goc.id)
    must(
      await db()
        .from('hr_calc_versions')
        .update({
          standard_days: ts.congChuan,
          lunch_pay_percent: ts.ptTrua,
          withhold_tax: ts.truThue,
        })
        .eq('id', ban.id),
    )
    await this.ghiKhung(ban.id, khung)
    await this.ghiHeSo(ban.id, heSo, userId)
    return { id: ban.id, so }
  },

  async suaQuyTac(banId: string, q: QuyTac, userId: string): Promise<void> {
    must(
      await db()
        .from('hr_calc_versions')
        .update({ ...cotQuyTac(q), updated_by: userId })
        .eq('id', banId)
        .eq('status', 'draft'),
    )
  },

  async ghiKhung(banId: string, khung: KhungBan[]): Promise<void> {
    must(await db().from('hr_calc_frames').delete().eq('version_id', banId))
    must(
      await db()
        .from('hr_calc_frames')
        .insert(
          khung.map((k) => ({
            version_id: banId,
            code: k.ma,
            name: k.ten,
            from_minute: k.tu,
            to_minute: k.den,
            drop_remainder: k.boPhanLo,
            is_office: k.hanhChinh,
            night_shift: k.caDem,
          })),
        ),
    )
  },

  async ghiHeSo(banId: string, heSo: HeSoDong[], userId: string): Promise<void> {
    if (!heSo.length) return
    must(
      await db()
        .from('hr_calc_rates')
        .upsert(
          heSo.map((h) => ({
            version_id: banId,
            kind: h.loai,
            code: h.ma,
            day_kind: h.ngay,
            percent: h.pt,
            below_law_reason: h.lyDo,
            updated_by: userId,
          })),
          { onConflict: 'version_id,kind,code,day_kind' },
        ),
    )
  },

  async danhDau(banId: string, userId: string): Promise<void> {
    must(
      await db().from('hr_calc_versions').update({ updated_by: userId }).eq('id', banId),
    )
  },

  async apDung(banId: string, tuKy: string, userId: string): Promise<void> {
    must(
      await db()
        .from('hr_calc_versions')
        .update({
          status: 'applied',
          from_period: tuKy,
          applied_by: userId,
          applied_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', banId)
        .eq('status', 'draft'),
    )
  },

  async rutVeNhap(banId: string, userId: string): Promise<void> {
    must(
      await db()
        .from('hr_calc_versions')
        .update({
          status: 'draft',
          from_period: null,
          applied_by: null,
          applied_at: null,
          updated_by: userId,
        })
        .eq('id', banId)
        .eq('status', 'applied'),
    )
  },

  async xoaNhap(banId: string): Promise<void> {
    must(
      await db().from('hr_calc_versions').delete().eq('id', banId).eq('status', 'draft'),
    )
  },

  /** Danh mục tổ (0242) + số người đang làm + tên tổ sản xuất nối tới. */
  async to(): Promise<
    { ten: string; cachTinh: CachTinh; toSx: string | null; soNguoi: number }[]
  > {
    const [teams, emps] = await Promise.all([
      db()
        .from('hr_teams')
        .select('id, name, calc_mode, dep:departments!hr_teams_department_id_fkey(name)')
        .eq('active', true)
        .order('name'),
      db().from('hr_employees').select('team_id').eq('active', true),
    ])
    const dem = new Map<string, number>()
    for (const e of must(emps))
      if (e.team_id) dem.set(e.team_id, (dem.get(e.team_id) ?? 0) + 1)
    return must(teams).map((t) => ({
      ten: t.name,
      cachTinh: cachTinhCua(t.calc_mode),
      toSx: t.dep?.name ?? null,
      soNguoi: dem.get(t.id) ?? 0,
    }))
  },

  async soNguoiChuaCoTo(): Promise<number> {
    const r = await db()
      .from('hr_employees')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .is('team_id', null)
    if (r.error) throw new Error(r.error.message)
    return r.count ?? 0
  },
}
