import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { boSo0, khopDuoiTen } from '@/lib/cham-cong/ghep-ten'
import { gopLap, type LuotQuet } from '@/lib/cham-cong/luot'
import { chamCongRepo, type DeviceRow, type DeviceUserRow } from './cham-cong.repo'
import { infoDevice, readDevice } from './zk'
import { dieuChinhRepo } from './dieu-chinh.repo'
import { bienDongRepo } from './bien-dong.repo'
import { quyenDieuChinh, type QuyenDieuChinh } from './dieu-chinh.service'
import type { DieuChinh } from '@/lib/cham-cong/dieu-chinh'

/**
 * CHẤM CÔNG — kéo lượt quẹt thẳng từ máy ZKTeco, ghép người, bày lượt thô.
 *
 * File này lo phần dữ liệu: lượt thô bất biến → (máy, mã) → nhân viên → ngày giờ
 * Việt Nam. Tính giờ công ở `gio-cong.service.ts` (luật khung giờ `gio-khung.ts`).
 */

const VN_MS = 7 * 3600_000

/** ISO bất kỳ → 'YYYY-MM-DD HH:mm:ss' giờ Việt Nam. */
export function toVn(iso: string): string {
  return new Date(new Date(iso).getTime() + VN_MS)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')
}

/** Giờ tường VN 'YYYY-MM-DD HH:mm:ss' → timestamptz có múi. */
const fromVn = (wall: string) => `${wall.replace(' ', 'T')}+07:00`

const norm = (s: string | null | undefined) =>
  (s ?? '').normalize('NFC').toUpperCase().replace(/\s+/g, ' ').trim()

/** 'YYYY-MM-DD' → ngày hôm sau. */
function sauNgay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`)
  t.setUTCDate(t.getUTCDate() + 1)
  return t.toISOString().slice(0, 10)
}

/** Nhãn ngắn của máy cho lưới: '.201'. */
const nhanMay = (d: DeviceRow) => '.' + d.ip.split('.').pop()

export type KetQuaMay = {
  ten: string
  ip: string
  ok: boolean
  loi?: string
  luotTrenMay?: number
  /** Lượt trên máy nằm trong khoảng ngày đã chọn. */
  luotTrongKhoang?: number
  /** Trong số đó, bao nhiêu lượt chưa có trong ERP (lấy lại cùng khoảng = 0). */
  luotMoi?: number
}

/** Khoảng ngày cần lấy về, 'YYYY-MM-DD', tính cả hai đầu. */
export type KhoangNgay = { tu: string; den: string }

export type KetQuaKeo = {
  khoang: KhoangNgay
  may: KetQuaMay[]
  /** (máy, mã) có quẹt trong khoảng, lần này mới ghép được người. */
  maDaGhep: number
  /** (máy, mã) có quẹt trong khoảng mà chưa ghép được ai — Nhân sự gán tay. */
  maChuaGhep: number
  canXem: number
}

/**
 * Đọc một máy rồi CHỈ LƯU lượt nằm trong khoảng ngày (chủ dự án 12/10/2026: không
 * nạp sẵn cả lịch sử, cần ngày nào thì lấy ngày đó). Máy không lọc được theo ngày
 * nên vẫn phải đọc hết log, lọc ở đây. Khoá duy nhất (máy, mã, giờ) cho phép lấy
 * lại cùng khoảng bao nhiêu lần cũng không nhân đôi.
 */
async function keoMot(d: DeviceRow, k: KhoangNgay, userId: string): Promise<KetQuaMay> {
  const base = { ten: d.name, ip: d.ip }
  const batDau = new Date().toISOString()
  const ghiLan = (r: {
    ok: boolean
    luot?: number
    trong?: number
    moi?: number
    loi?: string
  }) =>
    chamCongRepo
      .insertPull({
        device_id: d.id,
        created_by: userId,
        date_from: k.tu,
        date_to: k.den,
        started_at: batDau,
        ok: r.ok,
        device_log_count: r.luot ?? null,
        logs_in_range: r.trong ?? null,
        logs_new: r.moi ?? null,
        error: r.loi ?? null,
      })
      // Ghi vết hỏng không được làm hỏng lần lấy đã thành công.
      .catch((e) => console.error('[cham-cong] ghi lịch sử lấy hỏng', e))
  try {
    const r = await readDevice(d.ip, d.port)
    await chamCongRepo.upsertDeviceUsers(
      r.users.map((u) => ({
        device_id: d.id,
        device_user_id: u.code,
        name_on_device: u.name,
      })),
    )
    const tu = `${k.tu} 00:00:00`
    const den = `${k.den} 23:59:59`
    // Mỗi (mã, giây) một lượt — máy đôi khi ghi trùng y hệt.
    const gui = [
      ...new Map(
        r.logs
          .filter((l) => l.at >= tu && l.at <= den)
          .map((l) => [`${l.code}|${l.at}`, l]),
      ).values(),
    ]
    const daCo = await chamCongRepo.countLogs(d.id)
    await chamCongRepo.insertLogs(
      gui.map((l) => ({
        device_id: d.id,
        device_user_id: l.code,
        punched_at: fromVn(l.at),
        verify_type: l.verifyType,
        state: l.state,
      })),
    )
    const sau = await chamCongRepo.countLogs(d.id)
    await chamCongRepo.updateDevice(d.id, {
      serial: r.serial ?? d.serial,
      last_pulled_at: new Date().toISOString(),
      last_log_count: r.logCount,
      log_capacity: r.logCapacity,
      last_user_count: r.users.length,
      last_error: null,
    })
    await ghiLan({ ok: true, luot: r.logCount, trong: gui.length, moi: sau - daCo })
    return {
      ...base,
      ok: true,
      luotTrenMay: r.logCount,
      luotTrongKhoang: gui.length,
      luotMoi: sau - daCo,
    }
  } catch (e) {
    const loi = e instanceof Error ? e.message : String(e)
    await chamCongRepo.updateDevice(d.id, { last_error: loi })
    await ghiLan({ ok: false, loi })
    return { ...base, ok: false, loi }
  }
}

/**
 * Ghép (máy, mã) chưa có người cho các mã có quẹt TRONG KHOẢNG vừa lấy. KHÔNG tạo
 * nhân viên mới (15/10/2026: tạo tự động từ tên máy đẻ ra 139 hồ sơ tên rác kiểu
 * "P TUAN"; danh sách nhân viên nay do Nhân sự lập) — mã không ghép được ở lại
 * "chưa ghép" để Nhân sự gán tay. Chỉ ghép khi chắc:
 *   - cùng số + tên máy khớp ở máy kia, và phía đó đã có người → cùng người đó;
 *   - nhân viên có mã NV = mã máy VÀ tên máy là đuôi họ tên của họ.
 * Cùng số khác tên giữa hai máy = hai người: đánh dấu `needs_review` cả hai phía.
 * Không bao giờ gỡ hay đổi một ghép đã có.
 */
async function ghepNguoi(
  k: KhoangNgay,
): Promise<{ ghep: number; chuaGhep: number; canXem: number }> {
  const [dus, emps] = await Promise.all([
    chamCongRepo.deviceUsers(),
    chamCongRepo.employees(),
  ])
  const logs = await chamCongRepo.logsBetween(
    `${k.tu}T00:00:00+07:00`,
    `${sauNgay(k.den)}T00:00:00+07:00`,
  )
  const coQuet = new Set(logs.map((l) => `${l.device_id}|${l.device_user_id}`))
  const duBy = new Map(dus.map((u) => [`${u.device_id}|${u.device_user_id}`, u]))
  const empByCode = new Map(emps.map((e) => [boSo0(e.code), e]))
  const sua = new Map<string, DeviceUserRow>()
  let chuaGhep = 0

  for (const key of coQuet) {
    const du = duBy.get(key)
    if (!du || du.employee_id) continue
    const khac = dus.filter(
      (o) => o.device_user_id === du.device_user_id && o.device_id !== du.device_id,
    )
    const cungTen = khac.filter((o) => norm(o.name_on_device) === norm(du.name_on_device))
    const khacTen = khac.length > cungTen.length
    for (const o of khac)
      if (!cungTen.includes(o) && !o.needs_review)
        sua.set(o.id, { ...o, needs_review: true })

    const nguoi =
      cungTen.find((o) => o.employee_id)?.employee_id ??
      (() => {
        const e = empByCode.get(boSo0(du.device_user_id))
        return e && khopDuoiTen(e.full_name, du.name_on_device) ? e.id : null
      })()
    if (nguoi) sua.set(du.id, { ...du, employee_id: nguoi, needs_review: khacTen })
    else {
      chuaGhep++
      if (khacTen && !du.needs_review) sua.set(du.id, { ...du, needs_review: true })
    }
  }

  const rows = [...sua.values()]
  if (rows.length) await chamCongRepo.linkDeviceUsers(rows)
  return {
    ghep: rows.filter(
      (r) => r.employee_id && !dus.find((d) => d.id === r.id)?.employee_id,
    ).length,
    chuaGhep,
    canXem: rows.filter((r) => r.needs_review).length,
  }
}

/** Máy đang được đọc (id) — chặn hai lượt lấy chồng nhau trên cùng máy. */
const dangDoc = new Set<string>()

/** Xem lượt thô tối đa ngần này ngày một lần (một tháng ~2.600 dòng người-ngày). */
export const XEM_TOI_DA_NGAY = 62

export type MayTomTat = {
  id: string
  ten: string
  nhan: string
  ip: string
  port: number
  serial: string | null
  keoLuc: string | null
  luot: number | null
  sucChua: number | null
  soNguoi: number | null
  loi: string | null
}

const tomTatMay = (d: DeviceRow): MayTomTat => ({
  id: d.id,
  ten: d.name,
  nhan: nhanMay(d),
  ip: d.ip,
  port: d.port,
  serial: d.serial,
  keoLuc: d.last_pulled_at,
  luot: d.last_log_count,
  sucChua: d.log_capacity,
  soNguoi: d.last_user_count,
  loi: d.last_error,
})

export type LanLay = {
  id: string
  may: string
  tu: string
  den: string
  batDau: string
  xong: string
  ok: boolean
  luotTrenMay: number | null
  luotTrongKhoang: number | null
  luotMoi: number | null
  loi: string | null
  nguoi: string | null
}

/** Một dòng của trang Lấy dữ liệu: một người (hoặc một mã chưa ghép) trong một ngày. */
export type DongLuot = {
  /** 'YYYY-MM-DD' */
  ngay: string
  ma: string
  ten: string
  /** Bộ phận / tổ của nhân viên; null khi chưa ghép hoặc chưa khai. */
  boPhan: string | null
  /** false = mã trên máy chưa ghép nhân viên nào. */
  daGhep: boolean
  /** Lượt sau khi gộp lặp 2 phút; `lap` = số lượt lặp đã gộp vào. */
  luot: { gio: string; may: string; lap: number }[]
  /** Số lượt máy ghi, kể cả lượt bấm lặp. */
  soLuotTho: number
}

export type DuLieu = {
  khoang: KhoangNgay
  /** Mỗi ngày trong khoảng: số lượt thô theo từng máy (nhãn máy → số). */
  theoNgay: { ngay: string; theoMay: Record<string, number> }[]
  dong: DongLuot[]
  may: MayTomTat[]
  lanCuoi: LanLay[]
  /** Mã trên máy có quẹt trong khoảng mà cùng số ở máy kia là người khác (`needs_review`). */
  maCanXem: number
  /** Nhân viên đang làm CẦN chấm công — mẫu số của bảng có mặt theo tổ. */
  nhanSu: { ma: string; ten: string; boPhan: string | null }[]
  /** Số người đang làm có cờ Không chấm công (không vào mẫu số). */
  khongCham: number
  /** Điều chỉnh trong khoảng (mọi tình trạng) — chỉ bản đã duyệt đổi kết quả. */
  dieuChinh: DieuChinh[]
}

/**
 * Một KỲ CÔNG = một tháng dương lịch (chủ dự án chốt 12/10/2026). Trang Chấm công là
 * trang của một kỳ: bước ① cần lượt thô cả kỳ, ngăn kéo Máy cần tình trạng máy +
 * lịch sử lấy — nạp một lượt cho cả trang.
 */
export type KyCong = {
  thang: string
  /** Đầu kỳ / cuối kỳ, 'YYYY-MM-DD'. */
  tu: string
  den: string
  homNay: string
  du: DuLieu
  lanLay: LanLay[]
  /** Chỉ nạp khi mở bước ② (danh sách nhân viên + mã máy 45 ngày). */
  nv: NhanVienData | null
  quyen: QuyenDieuChinh
}

function soNgay(k: KhoangNgay): number {
  return Math.round((Date.parse(k.den) - Date.parse(k.tu)) / 86400_000) + 1
}

function toLanLay(
  rows: Awaited<ReturnType<typeof chamCongRepo.recentPulls>>,
  devById: Map<string, DeviceRow>,
): LanLay[] {
  return rows.map((p) => ({
    id: p.id,
    may: devById.get(p.device_id)?.name ?? '—',
    tu: p.date_from,
    den: p.date_to,
    batDau: p.started_at,
    xong: p.finished_at,
    ok: p.ok,
    luotTrenMay: p.device_log_count,
    luotTrongKhoang: p.logs_in_range,
    luotMoi: p.logs_new,
    loi: p.error,
    nguoi: p.created_by_name,
  }))
}

/** Số ngày nhìn lại để biết mã nào "đang quẹt" (người đang đi làm). */
export const NV_NHIN_LAI_NGAY = 45

/** Một mã trên máy (dòng `hr_device_users`) như bước ② bày. */
export type NvMa = {
  /** id dòng `hr_device_users` */
  id: string
  may: string
  ma: string
  ten: string | null
  /** Cùng số ở máy kia là người khác — Nhân sự phải xem. */
  canXem: boolean
  /** Số lượt trong NV_NHIN_LAI_NGAY ngày gần nhất. */
  luotGanDay: number
  /** Ngày quẹt cuối 'YYYY-MM-DD' (trong khoảng nhìn lại), null = không quẹt. */
  lanCuoi: string | null
}

export type NvDong = {
  id: string
  code: string
  hoTen: string
  boPhan: string | null
  shiftId: string
  active: boolean
  ma: NvMa[]
  /** Họ tên vẫn y như tên trên máy (chưa ai gõ họ tên đầy đủ). */
  tenTuMay: boolean
  /** Tạo với ca mặc định khi nạp, chưa ai xem lại ca. */
  caMacDinh: boolean
  /** Không chấm công (Kinh Doanh, Tài Xế, Bốc xếp, Bảo Vệ…): không bị tính thiếu công. */
  khongChamCong: boolean
  lanCuoi: string | null
  /** Ngày vào / ngày làm cuối / lý do / chức danh (0248). */
  ngayVao: string | null
  ngayCuoi: string | null
  lyDoNghi: string | null
  chucDanh: string | null
  /** Tài khoản ERP gắn với người này (Admin cấp, 0252). Chỉ để xem ở Nhân sự. */
  taiKhoan: { email: string; mo: boolean } | null
}

export type NhanVienData = {
  ds: NvDong[]
  cas: { id: string; ten: string; gio: string }[]
  /** Mã có quẹt gần đây mà chưa ghép ai. */
  maChuaGhep: NvMa[]
  boPhan: string[]
  nhinLaiTu: string
}

/** Đuôi ghi chú đánh dấu "ca mặc định khi nạp" — xoá khi có người đổi/xác nhận ca. */
const DUOI_CA_MAC_DINH = ' · ca mặc định Xưởng, cần xem lại'

/**
 * `luot: false` — bỏ đọc lượt quẹt 45 ngày của cả công ty (phần nặng nhất, ~1–2 s): hồ sơ
 * nhân viên không bày "quẹt gần nhất" trên danh sách, còn trang một người tự đọc của riêng
 * người đó. Khi đó `lanCuoi` / `luotGanDay` = trống và `maChuaGhep` rỗng.
 */
async function taiNhanVien(homNay: string, luot = true): Promise<NhanVienData> {
  const tu = new Date(`${homNay}T00:00:00Z`)
  tu.setUTCDate(tu.getUTCDate() - NV_NHIN_LAI_NGAY + 1)
  const nhinLaiTu = tu.toISOString().slice(0, 10)
  const [devices, dus, emps, shifts, logs, tks] = await Promise.all([
    chamCongRepo.devices(),
    chamCongRepo.deviceUsers(),
    chamCongRepo.employees(),
    chamCongRepo.shifts(),
    luot
      ? chamCongRepo.logsBetween(
          `${nhinLaiTu}T00:00:00+07:00`,
          `${sauNgay(homNay)}T00:00:00+07:00`,
        )
      : Promise.resolve([]),
    chamCongRepo.taiKhoanGan(),
  ])
  const tkTheoNv = new Map(
    tks.map((t) => [t.employee_id, { email: t.email, mo: t.is_active }]),
  )
  const devById = new Map(devices.map((d) => [d.id, d]))
  const dem = new Map<string, { n: number; cuoi: string }>()
  for (const l of logs) {
    const k = `${l.device_id}|${l.device_user_id}`
    const ngay = toVn(l.punched_at).slice(0, 10)
    const x = dem.get(k) ?? { n: 0, cuoi: '' }
    x.n++
    if (ngay > x.cuoi) x.cuoi = ngay
    dem.set(k, x)
  }
  const toMa = (u: DeviceUserRow): NvMa => {
    const x = dem.get(`${u.device_id}|${u.device_user_id}`)
    return {
      id: u.id,
      may: nhanMay(devById.get(u.device_id)!),
      ma: u.device_user_id,
      ten: u.name_on_device,
      canXem: u.needs_review,
      luotGanDay: x?.n ?? 0,
      lanCuoi: x?.cuoi || null,
    }
  }
  const maTheoNguoi = new Map<string, NvMa[]>()
  for (const u of dus) {
    if (!u.employee_id) continue
    maTheoNguoi.set(u.employee_id, [...(maTheoNguoi.get(u.employee_id) ?? []), toMa(u)])
  }
  const ds: NvDong[] = emps.map((e) => {
    const ma = (maTheoNguoi.get(e.id) ?? []).sort((a, b) => a.may.localeCompare(b.may))
    return {
      id: e.id,
      code: e.code,
      hoTen: e.full_name,
      boPhan: e.team,
      shiftId: e.shift_id,
      active: e.active,
      ma,
      tenTuMay: ma.some((m) => norm(m.ten) === norm(e.full_name)),
      caMacDinh: (e.note ?? '').includes('ca mặc định'),
      khongChamCong: e.attendance_exempt,
      lanCuoi: ma.reduce<string | null>(
        (c, m) => (m.lanCuoi && (!c || m.lanCuoi > c) ? m.lanCuoi : c),
        null,
      ),
      taiKhoan: tkTheoNv.get(e.id) ?? null,
      ngayVao: e.hire_date,
      ngayCuoi: e.leave_date,
      lyDoNghi: e.leave_reason,
      chucDanh: e.job_title,
    }
  })
  return {
    ds,
    cas: shifts.map((s) => ({
      id: s.id,
      ten: s.name,
      gio: `${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`,
    })),
    maChuaGhep: dus
      .filter((u) => !u.employee_id)
      .map(toMa)
      .filter((m) => m.luotGanDay > 0)
      .sort((a, b) => b.luotGanDay - a.luotGanDay),
    boPhan: [...new Set(emps.map((e) => e.team).filter((t): t is string => !!t))].sort(
      (a, b) => a.localeCompare(b, 'vi'),
    ),
    nhinLaiTu,
  }
}

const boDuoiCa = (note: string | null) =>
  note?.includes(DUOI_CA_MAC_DINH) ? note.replace(DUOI_CA_MAC_DINH, '') || null : note

/** Một lần xem "Chấm công một người" tối đa ngần này ngày (câu 16, duyệt 16/10/2026). */
export const MOT_NGUOI_TOI_DA_NGAY = 366

/** Một ngày trong ngăn "Chấm công một người" — có cả ngày không quẹt. */
export type NgayMotNguoi = {
  ngay: string
  /** Lượt sau khi gộp lặp 2 phút (giờ · máy), rỗng = không quẹt. */
  luot: { gio: string; may: string; lap: number }[]
  /** Số lượt máy ghi, kể cả lượt bấm lặp. */
  soLuotTho: number
  /** false = cả công ty chưa có lượt nào ngày này: CHƯA LẤY về, không phải vắng. */
  daLay: boolean
}

export type MotNguoi = {
  nguoi: {
    ma: string
    ten: string
    boPhan: string | null
    ca: string
    khongChamCong: boolean
    maMay: string[]
  }
  khoang: KhoangNgay
  ngay: NgayMotNguoi[]
  dieuChinh: DieuChinh[]
  quyen: QuyenDieuChinh
}

export const chamCongService = {
  /** Ngăn "Chấm công một người": mọi ngày trong khoảng, kể cả ngày không quẹt. */
  async motNguoi(user: User, ma: string, k: KhoangNgay): Promise<MotNguoi> {
    await assertAction(user, 'hr.attendance.view')
    if (k.den < k.tu) throw BadRequest('"Đến ngày" phải sau hoặc bằng "Từ ngày"')
    if (soNgay(k) > MOT_NGUOI_TOI_DA_NGAY)
      throw BadRequest(`Mỗi lần xem tối đa ${MOT_NGUOI_TOI_DA_NGAY} ngày`)
    const [emps, dus, devices, shifts] = await Promise.all([
      chamCongRepo.employees(),
      chamCongRepo.deviceUsers(),
      chamCongRepo.devices(),
      chamCongRepo.shifts(),
    ])
    const e = emps.find((x) => x.code === ma)
    if (!e) throw NotFound(`Không có nhân viên mã ${ma}`)
    const devById = new Map(devices.map((d) => [d.id, d]))
    const cua = dus.filter((u) => u.employee_id === e.id)
    const tuIso = `${k.tu}T00:00:00+07:00`
    const denIso = `${sauNgay(k.den)}T00:00:00+07:00`
    const [logs, coLuot, dieuChinh, quyen] = await Promise.all([
      chamCongRepo.logsOfCodes(
        [...new Set(cua.map((u) => u.device_user_id))],
        tuIso,
        denIso,
      ),
      chamCongRepo.ngayCoLuot(tuIso, denIso),
      dieuChinhRepo.trongKhoang(k.tu, k.den, e.id),
      quyenDieuChinh(user),
    ])
    const laCua = new Set(cua.map((u) => `${u.device_id}|${u.device_user_id}`))
    const theoNgay = new Map<string, LuotQuet[]>()
    for (const l of logs) {
      if (!laCua.has(`${l.device_id}|${l.device_user_id}`)) continue
      const vn = toVn(l.punched_at)
      const arr = theoNgay.get(vn.slice(0, 10)) ?? []
      arr.push({ may: nhanMay(devById.get(l.device_id)!), gio: vn.slice(11) })
      theoNgay.set(vn.slice(0, 10), arr)
    }
    const daLay = new Set(coLuot)
    const ngay: NgayMotNguoi[] = []
    // Ngày sau hôm nay chưa tới — không bày (17/10/2026: 10 dòng "chưa lấy" thừa).
    const homNay = todayVn()
    const cuoi = k.den < homNay ? k.den : homNay
    for (let d = k.tu; d <= cuoi; d = sauNgay(d)) {
      const tho = theoNgay.get(d) ?? []
      ngay.push({
        ngay: d,
        luot: gopLap(tho).map((x) => ({ gio: x.gio, may: x.may, lap: x.lap })),
        soLuotTho: tho.length,
        daLay: daLay.has(d) || tho.length > 0,
      })
    }
    return {
      nguoi: {
        ma: e.code,
        ten: e.full_name,
        boPhan: e.team,
        ca: shifts.find((s) => s.id === e.shift_id)?.name ?? '',
        khongChamCong: e.attendance_exempt,
        maMay: cua.map(
          (u) => `${nhanMay(devById.get(u.device_id)!)} ${u.device_user_id}`,
        ),
      },
      khoang: k,
      ngay,
      dieuChinh,
      quyen,
    }
  },

  /** Bước ② — danh sách nhân viên chấm công + mã trên máy + mã có quẹt chưa ghép. */
  async nhanVien(
    user: User,
    homNay: string,
    opts: { luot?: boolean } = {},
  ): Promise<NhanVienData> {
    await assertAction(user, 'hr.attendance.view')
    return taiNhanVien(homNay, opts.luot ?? true)
  },

  async suaNhanVien(
    user: User,
    id: string,
    v: {
      full_name: string
      team: string | null
      shift_id: string
      attendance_exempt: boolean
      job_title?: string | null
    },
  ): Promise<void> {
    await assertAction(user, 'hr.attendance.employee_edit')
    const e = (await chamCongRepo.employees()).find((x) => x.id === id)
    if (!e) throw NotFound('Không tìm thấy nhân viên')
    // Lưu hồ sơ = có người đã nhìn ca → bỏ dấu "ca mặc định".
    await chamCongRepo.updateEmployee(id, { ...v, note: boDuoiCa(e.note) })
    const doi = [
      v.full_name !== e.full_name && 'Họ tên',
      (v.team ?? null) !== e.team && 'Tổ',
      v.job_title !== undefined && (v.job_title ?? null) !== e.job_title && 'Chức danh',
      v.shift_id !== e.shift_id && 'Ca thường làm',
      v.attendance_exempt !== e.attendance_exempt && 'Chấm công',
    ].filter((x): x is string => !!x)
    if (doi.length)
      await bienDongRepo.ghi({
        employeeId: id,
        loai: 'edit',
        ngay: todayVn(),
        ghiChu: `Công việc: ${doi.join(', ')}`,
        truoc: { doi },
        userId: user.id,
      })
  },

  // Thêm nhân viên → bienDongService.tuyenVao (0248: có ngày vào, nhận người không chấm công).

  async doiHangLoat(
    user: User,
    v: { ids: string[]; shift_id?: string; team?: string | null },
  ): Promise<{ so: number }> {
    await assertAction(user, 'hr.attendance.employee_edit')
    const byId = new Map((await chamCongRepo.employees()).map((e) => [e.id, e]))
    let so = 0
    for (const id of v.ids) {
      const e = byId.get(id)
      if (!e) continue
      await chamCongRepo.updateEmployee(id, {
        ...(v.shift_id !== undefined && { shift_id: v.shift_id, note: boDuoiCa(e.note) }),
        ...(v.team !== undefined && { team: v.team }),
      })
      const doi = [
        v.team !== undefined && v.team !== e.team && 'Tổ',
        v.shift_id !== undefined && v.shift_id !== e.shift_id && 'Ca thường làm',
      ].filter((x): x is string => !!x)
      if (doi.length)
        await bienDongRepo.ghi({
          employeeId: id,
          loai: 'edit',
          ngay: todayVn(),
          ghiChu: `Đổi hàng loạt: ${doi.join(', ')}`,
          truoc: { doi },
          userId: user.id,
        })
      so++
    }
    return { so }
  },

  /** Ghép một mã trên máy vào nhân viên, hoặc gỡ (`employee_id` null). */
  async ghepMa(
    user: User,
    v: { device_user_id: string; employee_id: string | null },
  ): Promise<void> {
    await assertAction(user, 'hr.attendance.employee_edit')
    await chamCongRepo.updateDeviceUser(v.device_user_id, {
      employee_id: v.employee_id,
      needs_review: false,
    })
  },

  /**
   * LƯỢT THÔ trong khoảng ngày — đúng những gì máy ghi, KHÔNG tính công, không kết
   * luận thiếu/đủ (chủ dự án 12/10/2026: lấy dữ liệu trước, tính sau). Gộp theo
   * người (mã đã ghép) hoặc theo (máy, mã) nếu chưa ghép, rồi theo ngày.
   */
  async duLieu(user: User, k: KhoangNgay): Promise<DuLieu> {
    await assertAction(user, 'hr.attendance.view')
    if (k.den < k.tu) throw BadRequest('"Đến ngày" phải sau hoặc bằng "Từ ngày"')
    if (soNgay(k) > XEM_TOI_DA_NGAY)
      throw BadRequest(`Mỗi lần xem tối đa ${XEM_TOI_DA_NGAY} ngày`)
    const [devices, dus, emps, logs, pulls, dieuChinh] = await Promise.all([
      chamCongRepo.devices(),
      chamCongRepo.deviceUsers(),
      chamCongRepo.employees(),
      chamCongRepo.logsBetween(
        `${k.tu}T00:00:00+07:00`,
        `${sauNgay(k.den)}T00:00:00+07:00`,
      ),
      chamCongRepo.recentPulls(5),
      dieuChinhRepo.trongKhoang(k.tu, k.den),
    ])
    const devById = new Map(devices.map((d) => [d.id, d]))
    const duBy = new Map(dus.map((u) => [`${u.device_id}|${u.device_user_id}`, u]))
    const empById = new Map(emps.map((e) => [e.id, e]))

    const theoNgay = new Map<string, Record<string, number>>()
    for (let d = k.tu; d <= k.den; d = sauNgay(d)) theoNgay.set(d, {})
    const nhom = new Map<
      string,
      {
        ngay: string
        ma: string
        ten: string
        boPhan: string | null
        daGhep: boolean
        luot: LuotQuet[]
      }
    >()
    for (const l of logs) {
      const vn = toVn(l.punched_at)
      const ngay = vn.slice(0, 10)
      const nhan = nhanMay(devById.get(l.device_id)!)
      const dem = theoNgay.get(ngay)
      if (dem) dem[nhan] = (dem[nhan] ?? 0) + 1
      const du = duBy.get(`${l.device_id}|${l.device_user_id}`)
      const emp = du?.employee_id ? empById.get(du.employee_id) : undefined
      const key = emp
        ? `${ngay}|e|${emp.id}`
        : `${ngay}|m|${l.device_id}|${l.device_user_id}`
      const g = nhom.get(key) ?? {
        ngay,
        ma: emp?.code ?? l.device_user_id,
        ten: emp?.full_name ?? du?.name_on_device ?? '',
        boPhan: emp?.team ?? null,
        daGhep: !!emp,
        luot: [],
      }
      g.luot.push({ may: nhan, gio: vn.slice(11) })
      nhom.set(key, g)
    }
    const dong: DongLuot[] = [...nhom.values()]
      .map((g) => ({
        ngay: g.ngay,
        ma: g.ma,
        ten: g.ten,
        boPhan: g.boPhan,
        daGhep: g.daGhep,
        luot: gopLap(g.luot).map((x) => ({ gio: x.gio, may: x.may, lap: x.lap })),
        soLuotTho: g.luot.length,
      }))
      .sort((a, b) =>
        a.ngay < b.ngay
          ? -1
          : a.ngay > b.ngay
            ? 1
            : a.luot[0].gio < b.luot[0].gio
              ? -1
              : 1,
      )

    return {
      khoang: k,
      theoNgay: [...theoNgay].map(([ngay, theoMay]) => ({ ngay, theoMay })),
      dong,
      may: devices.map(tomTatMay),
      lanCuoi: toLanLay(pulls, devById),
      maCanXem: new Set(
        logs
          .map((l) => duBy.get(`${l.device_id}|${l.device_user_id}`))
          .filter((u) => u?.needs_review)
          .map((u) => u!.id),
      ).size,
      nhanSu: emps
        .filter((e) => e.active && !e.attendance_exempt)
        .map((e) => ({ ma: e.code, ten: e.full_name, boPhan: e.team })),
      khongCham: emps.filter((e) => e.active && e.attendance_exempt).length,
      dieuChinh,
    }
  },

  /** Dữ liệu cho trang Kỳ công tháng `thang` ('YYYY-MM'). */
  async kyCong(
    user: User,
    thang: string,
    homNay: string,
    coNhanVien = false,
  ): Promise<KyCong> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang))
      throw BadRequest('Tháng phải dạng YYYY-MM')
    const [y, m] = thang.split('-').map(Number)
    const tu = `${thang}-01`
    const den = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const [du, may, nv, quyen] = await Promise.all([
      chamCongService.duLieu(user, { tu, den }),
      chamCongService.mayChamCong(user),
      coNhanVien ? chamCongService.nhanVien(user, homNay) : null,
      quyenDieuChinh(user),
    ])
    return { thang, tu, den, homNay, du, lanLay: may.lanLay, nv, quyen }
  },

  /** Trang Máy chấm công: tình trạng từng máy + lịch sử các lần lấy. */
  async mayChamCong(user: User): Promise<{ may: MayTomTat[]; lanLay: LanLay[] }> {
    await assertAction(user, 'hr.attendance.view')
    const [devices, pulls] = await Promise.all([
      chamCongRepo.devices(),
      chamCongRepo.recentPulls(60),
    ])
    const devById = new Map(devices.map((d) => [d.id, d]))
    return { may: devices.map(tomTatMay), lanLay: toLanLay(pulls, devById) }
  },

  /** Kiểm kết nối: đọc serial + số lượt / sức chứa / số người — vài giây, không kéo log. */
  async kiemMay(user: User): Promise<{ ten: string; ok: boolean; loi?: string }[]> {
    await assertAction(user, 'hr.attendance.pull')
    const devices = (await chamCongRepo.devices()).filter((d) => d.active)
    const out: { ten: string; ok: boolean; loi?: string }[] = []
    for (const d of devices) {
      try {
        const r = await infoDevice(d.ip, d.port)
        await chamCongRepo.updateDevice(d.id, {
          serial: r.serial ?? d.serial,
          last_log_count: r.logCount,
          log_capacity: r.logCapacity,
          last_user_count: r.userCount,
          last_error: null,
        })
        out.push({ ten: d.name, ok: true })
      } catch (e) {
        const loi = e instanceof Error ? e.message : String(e)
        await chamCongRepo.updateDevice(d.id, { last_error: loi })
        out.push({ ten: d.name, ok: false, loi })
      }
    }
    return out
  },

  /** Lấy lượt trong khoảng ngày từ mọi máy đang dùng, rồi ghép người. Chỉ ĐỌC máy. */
  async keoTuMay(user: User, k: KhoangNgay): Promise<KetQuaKeo> {
    await assertAction(user, 'hr.attendance.pull')
    if (k.den < k.tu) throw BadRequest('"Đến ngày" phải sau hoặc bằng "Từ ngày"')
    const devices = (await chamCongRepo.devices()).filter((d) => d.active)
    // Máy ZK chỉ phục vụ một kết nối: hai người bấm cùng lúc thì lượt sau đọc hỏng
    // hoặc thiếu. Server chạy một tiến trình trong LAN xưởng nên khoá trong bộ nhớ là đủ.
    const ban = devices.find((d) => dangDoc.has(d.id))
    if (ban)
      throw Conflict(`Đang có người lấy từ ${ban.name} — đợi lượt đó xong rồi bấm lại.`)
    devices.forEach((d) => dangDoc.add(d.id))
    try {
      const may: KetQuaMay[] = []
      // Lần lượt từng máy: đọc song song hai máy cùng lúc không nhanh hơn (mỗi máy
      // một đường), lại khó biết máy nào làm hỏng.
      for (const d of devices) may.push(await keoMot(d, k, user.id))
      const g = may.some((m) => m.ok)
        ? await ghepNguoi(k)
        : { ghep: 0, chuaGhep: 0, canXem: 0 }
      return {
        khoang: k,
        may,
        maDaGhep: g.ghep,
        maChuaGhep: g.chuaGhep,
        canXem: g.canXem,
      }
    } finally {
      devices.forEach((d) => dangDoc.delete(d.id))
    }
  },
}
