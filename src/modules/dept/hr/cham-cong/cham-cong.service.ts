import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest } from '@/server/http'
import {
  doanCa,
  gopLap,
  tinhNgay,
  tongThang,
  type Ca,
  type KetQuaNgay,
  type LoaiNgay,
  type LuotQuet,
  type TongThang,
} from '@/lib/cham-cong/tinh-cong'
import {
  chamCongRepo,
  type DeviceRow,
  type DeviceUserRow,
  type ShiftRow,
} from './cham-cong.repo'
import { infoDevice, readDevice } from './zk'

/**
 * CHẤM CÔNG — kéo lượt quẹt thẳng từ máy ZKTeco, ghép người, tính công tháng.
 *
 * Luật tính: `@/lib/cham-cong/tinh-cong` (thuần, có test). File này lo phần dữ liệu:
 * lượt thô bất biến → (máy, mã) → nhân viên → ngày giờ Việt Nam → tinhNgay.
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

function toCa(s: ShiftRow): Ca {
  return {
    code: s.code,
    name: s.name,
    start: s.start_time.slice(0, 5),
    end: s.end_time.slice(0, 5),
    breakMin: s.break_minutes,
    requiredPunches: s.required_punches === 1 ? 1 : 2,
    otFrom: s.ot_from.slice(0, 5),
    otRound: s.ot_round_minutes,
    graceMin: s.late_grace_minutes,
  }
}

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
  nhanVienMoi: number
  maDaGhep: number
  canXem: number
}

export type NguoiCong = {
  id: string
  code: string
  ten: string
  ca: string
  /** Nhãn các máy người này có quẹt trong tháng ('.201', '.203'). */
  may: string[]
  /** Khoá = ngày trong tháng (1..31). */
  ngay: Record<number, KetQuaNgay>
  tong: TongThang
}

export type BangCong = {
  thang: string
  soNgay: number
  /** Thứ của ngày 1 (0 = chủ nhật) — client suy thứ mọi ngày khác. */
  thuNgay1: number
  ngayLe: { ngay: number; ten: string }[]
  cas: (Ca & { soNguoi: number })[]
  may: {
    ten: string
    ip: string
    keoLuc: string | null
    luot: number | null
    sucChua: number | null
    loi: string | null
  }[]
  nguoi: NguoiCong[]
  canXem: { may: string; ma: string; ten: string; tenMayKia: string | null }[]
  /** Lượt trong tháng của mã chưa ghép người — KHÔNG có trong bảng công. */
  luotChuaGhep: number
  /** Ngày trong tháng đã có lượt trong ERP (đã lấy về) — ngày thiếu ở đây là CHƯA LẤY, không phải vắng. */
  ngayCoDuLieu: number[]
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
 * Ghép (máy, mã) chưa có người cho các mã có quẹt TRONG KHOẢNG vừa lấy (câu 7: không
 * tạo hồ sơ cho 1.042 mã cũ trên máy, chỉ người đang đi làm):
 *   - cùng số + cùng tên ở máy kia → CÙNG một người;
 *   - cùng số khác tên → hai người, đánh dấu `needs_review` cả hai phía;
 *   - người mới: mã NV = mã máy (trùng thì thêm đuôi máy), ca đoán theo giờ quẹt.
 * Không bao giờ gỡ hay đổi một ghép đã có.
 */
async function ghepNguoi(
  k: KhoangNgay,
): Promise<{ moi: number; ghep: number; canXem: number }> {
  const [devices, dus, emps, shifts] = await Promise.all([
    chamCongRepo.devices(),
    chamCongRepo.deviceUsers(),
    chamCongRepo.employees(),
    chamCongRepo.shifts(),
  ])
  const logs = await chamCongRepo.logsBetween(
    `${k.tu}T00:00:00+07:00`,
    `${sauNgay(k.den)}T00:00:00+07:00`,
  )

  // Ngày → lượt, theo (máy, mã)
  const theoMa = new Map<string, Map<string, string[]>>()
  for (const l of logs) {
    const k = `${l.device_id}|${l.device_user_id}`
    const vn = toVn(l.punched_at)
    const m = theoMa.get(k) ?? new Map<string, string[]>()
    const arr = m.get(vn.slice(0, 10)) ?? []
    arr.push(vn.slice(11))
    m.set(vn.slice(0, 10), arr)
    theoMa.set(k, m)
  }

  const duBy = new Map(dus.map((u) => [`${u.device_id}|${u.device_user_id}`, u]))
  const empById = new Map(emps.map((e) => [e.id, e]))
  const codes = new Set(emps.map((e) => e.code))
  const shiftByCode = new Map(shifts.map((s) => [s.code, s]))
  const devById = new Map(devices.map((d) => [d.id, d]))
  const sua = new Map<string, DeviceUserRow>()

  type Nhom = { dus: DeviceUserRow[]; ten: string; code: string; reviewKhac: boolean }
  const nhom: Nhom[] = []
  const daXet = new Set<string>()

  for (const k of theoMa.keys()) {
    const du = duBy.get(k)
    if (!du || du.employee_id || daXet.has(du.id)) continue
    daXet.add(du.id)
    const khac = dus.filter(
      (o) => o.device_user_id === du.device_user_id && o.device_id !== du.device_id,
    )
    const cungTen = khac.filter((o) => norm(o.name_on_device) === norm(du.name_on_device))
    const khacTen = khac.filter((o) => norm(o.name_on_device) !== norm(du.name_on_device))
    for (const o of khacTen) {
      if (!o.needs_review) sua.set(o.id, { ...o, needs_review: true })
    }
    // Phía máy kia đã có người → ghép theo luôn.
    const daCoNguoi = cungTen.find((o) => o.employee_id)
    if (daCoNguoi) {
      sua.set(du.id, {
        ...du,
        employee_id: daCoNguoi.employee_id,
        needs_review: khacTen.length > 0,
      })
      continue
    }
    // Nhân viên cùng mã + cùng tên (nhập tay trước đó) → ghép.
    const trung = emps.find(
      (e) =>
        e.code === du.device_user_id && norm(e.full_name) === norm(du.name_on_device),
    )
    if (trung) {
      for (const x of [du, ...cungTen])
        sua.set(x.id, { ...x, employee_id: trung.id, needs_review: khacTen.length > 0 })
      cungTen.forEach((x) => daXet.add(x.id))
      continue
    }
    cungTen.forEach((x) => daXet.add(x.id))
    nhom.push({
      dus: [du, ...cungTen],
      ten: du.name_on_device || `Mã ${du.device_user_id}`,
      code: du.device_user_id,
      reviewKhac: khacTen.length > 0,
    })
  }

  // Tạo người mới
  const moi = nhom.map((n) => {
    let code = n.code
    if (codes.has(code)) code = `${n.code}${nhanMay(devById.get(n.dus[0].device_id)!)}`
    codes.add(code)
    const ngay = new Map<string, string[]>()
    for (const du of n.dus) {
      for (const [d, arr] of theoMa.get(`${du.device_id}|${du.device_user_id}`) ?? []) {
        ngay.set(d, [...(ngay.get(d) ?? []), ...arr])
      }
    }
    const caCode = doanCa(
      [...ngay.values()].map((arr) => {
        const g = gopLap(arr.map((gio) => ({ may: '', gio })))
        return { dau: g[0].gio, soLuot: g.length }
      }),
    )
    const shift = shiftByCode.get(caCode) ?? shifts[0]
    if (!shift) throw new Error('Chưa có ca làm việc nào (hr_shifts rỗng)')
    return { code, full_name: n.ten, shift_id: shift.id }
  })
  const tao = moi.length ? await chamCongRepo.insertEmployees(moi) : []
  const byCode = new Map(tao.map((e) => [e.code, e]))
  nhom.forEach((n, i) => {
    const e = byCode.get(moi[i].code)
    if (!e) return
    empById.set(e.id, e)
    for (const du of n.dus)
      sua.set(du.id, { ...du, employee_id: e.id, needs_review: n.reviewKhac })
  })

  const rows = [...sua.values()]
  if (rows.length) await chamCongRepo.linkDeviceUsers(rows)
  return {
    moi: tao.length,
    ghep: rows.filter((r) => r.employee_id).length,
    canXem: rows.filter((r) => r.needs_review).length,
  }
}

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

export const chamCongService = {
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
    const [devices, dus, emps, logs, pulls] = await Promise.all([
      chamCongRepo.devices(),
      chamCongRepo.deviceUsers(),
      chamCongRepo.employees(),
      chamCongRepo.logsBetween(
        `${k.tu}T00:00:00+07:00`,
        `${sauNgay(k.den)}T00:00:00+07:00`,
      ),
      chamCongRepo.recentPulls(5),
    ])
    const devById = new Map(devices.map((d) => [d.id, d]))
    const duBy = new Map(dus.map((u) => [`${u.device_id}|${u.device_user_id}`, u]))
    const empById = new Map(emps.map((e) => [e.id, e]))

    const theoNgay = new Map<string, Record<string, number>>()
    for (let d = k.tu; d <= k.den; d = sauNgay(d)) theoNgay.set(d, {})
    const nhom = new Map<
      string,
      { ngay: string; ma: string; ten: string; daGhep: boolean; luot: LuotQuet[] }
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
    }
  },

  /** Dữ liệu cho trang Kỳ công tháng `thang` ('YYYY-MM'). */
  async kyCong(user: User, thang: string, homNay: string): Promise<KyCong> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang))
      throw BadRequest('Tháng phải dạng YYYY-MM')
    const [y, m] = thang.split('-').map(Number)
    const tu = `${thang}-01`
    const den = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    const [du, may] = await Promise.all([
      chamCongService.duLieu(user, { tu, den }),
      chamCongService.mayChamCong(user),
    ])
    return { thang, tu, den, homNay, du, lanLay: may.lanLay }
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
    const may: KetQuaMay[] = []
    // Lần lượt từng máy: đọc song song hai máy cùng lúc không nhanh hơn (mỗi máy
    // một đường), lại khó biết máy nào làm hỏng.
    for (const d of devices) may.push(await keoMot(d, k, user.id))
    const g = may.some((m) => m.ok) ? await ghepNguoi(k) : { moi: 0, ghep: 0, canXem: 0 }
    return {
      khoang: k,
      may,
      nhanVienMoi: g.moi,
      maDaGhep: g.ghep,
      canXem: g.canXem,
    }
  },

  async bangCong(user: User, thang: string): Promise<BangCong> {
    await assertAction(user, 'hr.attendance.view')
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(thang))
      throw BadRequest('Tháng phải dạng YYYY-MM')
    const [y, m] = thang.split('-').map(Number)
    const soNgay = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const sau = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
    const tu = `${thang}-01`
    const den = `${sau}-01`

    const [devices, dus, emps, shifts, hols, logs] = await Promise.all([
      chamCongRepo.devices(),
      chamCongRepo.deviceUsers(),
      chamCongRepo.employees(),
      chamCongRepo.shifts(),
      chamCongRepo.holidays(tu, den),
      chamCongRepo.logsBetween(`${tu}T00:00:00+07:00`, `${den}T00:00:00+07:00`),
    ])

    const devById = new Map(devices.map((d) => [d.id, d]))
    const duBy = new Map(dus.map((u) => [`${u.device_id}|${u.device_user_id}`, u]))
    const shiftById = new Map(shifts.map((s) => [s.id, s]))
    const le = new Map(hols.map((h) => [Number(h.holiday_date.slice(8, 10)), h.name]))
    const thuNgay1 = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()

    // nhân viên → ngày → lượt
    const theoNguoi = new Map<string, Map<number, LuotQuet[]>>()
    const mayCua = new Map<string, Set<string>>()
    let luotChuaGhep = 0
    const coDuLieu = new Set<number>()
    for (const l of logs) {
      coDuLieu.add(Number(toVn(l.punched_at).slice(8, 10)))
      const du = duBy.get(`${l.device_id}|${l.device_user_id}`)
      if (!du?.employee_id) {
        luotChuaGhep++
        continue
      }
      const vn = toVn(l.punched_at)
      const ngay = Number(vn.slice(8, 10))
      const nhan = nhanMay(devById.get(l.device_id)!)
      const byDay = theoNguoi.get(du.employee_id) ?? new Map<number, LuotQuet[]>()
      byDay.set(ngay, [...(byDay.get(ngay) ?? []), { may: nhan, gio: vn.slice(11) }])
      theoNguoi.set(du.employee_id, byDay)
      const s = mayCua.get(du.employee_id) ?? new Set<string>()
      s.add(nhan)
      mayCua.set(du.employee_id, s)
    }

    const nguoi: NguoiCong[] = []
    for (const e of emps) {
      const byDay = theoNguoi.get(e.id)
      if (!byDay) continue
      const shift = shiftById.get(e.shift_id)
      if (!shift) continue
      const ca = toCa(shift)
      const ngay: Record<number, KetQuaNgay> = {}
      for (const [d, luot] of byDay) {
        const loai: LoaiNgay = le.has(d)
          ? 'le'
          : (thuNgay1 + d - 1) % 7 === 0
            ? 'cn'
            : 'thuong'
        const r = tinhNgay(luot, ca, loai)
        if (r) ngay[d] = r
      }
      nguoi.push({
        id: e.id,
        code: e.code,
        ten: e.full_name,
        ca: shift.code,
        may: [...(mayCua.get(e.id) ?? [])].sort(),
        ngay,
        tong: tongThang(Object.values(ngay), ca),
      })
    }
    nguoi.sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }))

    const canXem = dus
      .filter((u) => u.needs_review)
      .map((u) => {
        const kia = dus.find(
          (o) => o.device_user_id === u.device_user_id && o.device_id !== u.device_id,
        )
        return {
          may: devById.get(u.device_id)?.name ?? '',
          ma: u.device_user_id,
          ten: u.name_on_device ?? '',
          tenMayKia: kia?.name_on_device ?? null,
        }
      })
      .sort(
        (a, b) =>
          a.ma.localeCompare(b.ma, 'vi', { numeric: true }) || a.may.localeCompare(b.may),
      )

    return {
      thang,
      soNgay,
      thuNgay1,
      ngayLe: [...le].map(([ngay, ten]) => ({ ngay, ten })),
      cas: shifts.map((s) => ({
        ...toCa(s),
        soNguoi: nguoi.filter((n) => n.ca === s.code).length,
      })),
      may: devices.map((d) => ({
        ten: d.name,
        ip: d.ip,
        keoLuc: d.last_pulled_at,
        luot: d.last_log_count,
        sucChua: d.log_capacity,
        loi: d.last_error,
      })),
      nguoi,
      canXem,
      luotChuaGhep,
      ngayCoDuLieu: [...coDuLieu].sort((a, b) => a - b),
    }
  },
}
