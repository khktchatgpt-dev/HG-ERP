/**
 * HỒ SƠ NHÂN VIÊN — danh sách + trang một người (B2a / B2b, bản vẽ lượt 2 duyệt 19/10/2026,
 * Q1–Q6 theo đề xuất). Khuôn E: không vòng duyệt; đầu trang là dải số.
 * Dùng lại danh sách của Chấm công (`nhanVien`) để danh sách và hồ sơ đếm bằng CÙNG một
 * nguồn; vết vào / ra lấy từ biến động (0248); thông tin cá nhân ở bảng riêng tư (0249).
 *
 * Ranh giới quyền (Q5): người có hr.employee.private (Nhân sự + BGĐ) nhận giá trị cá nhân,
 * CCCD vẫn che — bấm Hiện mới ra số và ghi nhật ký. Người khác chỉ nhận cờ có / chưa có.
 * Tab Lương & ngân hàng theo quyền hr.payroll.profile (Hồ sơ lương B4).
 */
import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { congNgay, kyCuaThang, thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import { soSanhMa, tinhVang, VANG_TU, type VangNv } from '@/lib/nhan-su/ho-so'
import {
  cheCccd,
  chuanCccd,
  chuanSdt,
  KHONG_CO_RIENG,
  type CaNhan,
  type CoRieng,
  type GioiTinh,
} from '@/lib/nhan-su/ca-nhan'
import { banHieuLuc, che, TEN_CACH_TRA, type CachTra } from '@/lib/luong/ho-so-luong'
import {
  chamCongService,
  NV_NHIN_LAI_NGAY,
  toVn,
  type NhanVienData,
  type NvDong,
} from './cham-cong.service'
import { chamCongRepo } from './cham-cong.repo'
import { bienDongRepo, type BienDongDong } from './bien-dong.repo'
import { caNhanRepo, COT_CA_NHAN, type CotCaNhan, type DongCaNhan } from './ca-nhan.repo'
import { hopDongRepo, type HdDong } from './hop-dong.repo'
import { hopDongService, type GiayTo } from './hop-dong.service'
import { hdHienHanh, type HdNgay } from '@/lib/nhan-su/hop-dong'
import { hoSoLuongRepo } from '../luong/ho-so-luong.repo'
import { suaLuong, xemLuong } from '../luong/quyen-luong'

const XEM_RIENG = 'hr.employee.private'

/** Một dòng hồ sơ: dòng Chấm công + cờ cá nhân + ngày HĐ đang áp (không lương, không số HĐ). */
export type NvHoSo = NvDong & { coRieng: CoRieng; hd: HdNgay | null; vang: VangNv | null }

export type DsNhanVien = Omit<NhanVienData, 'ds'> & { ds: NvHoSo[] }

/** Bản lương đang hiệu lực, tóm tắt cho tab Lương & ngân hàng. */
export type TomLuong = {
  thang: string
  ban: {
    tuKy: string
    cachTra: string
    donGia: number | null
    luongThang: number | null
    luongBh: number | null
    coBh: boolean
    npt: number
    phuCap: { ten: string; muc: number }[]
  } | null
  soBan: number
  nganHang: string | null
  stkChe: string | null
  mstChe: string | null
}

export type HoSoNvTrang = {
  n: NvHoSo
  bienDong: BienDongDong[]
  cas: NhanVienData['cas']
  boPhan: string[]
  chucDanh: string[]
  /** Mã người đang làm, xếp như danh sách mặc định — để ‹ › khi không có tập lọc. */
  dsMa: string[]
  homNay: string
  /** Kỳ công đang chạy: số ngày có quẹt / số ngày đã lấy dữ liệu (tới hôm nay). */
  ky: { thang: string; tu: string; den: string; coQuet: number | null; daLay: number }
  /** null = người xem không có quyền xem thông tin cá nhân. */
  caNhan: CaNhan | null
  /** null = người xem không có quyền hồ sơ lương. */
  luong: TomLuong | null
  /** Hợp đồng + giấy tờ — null khi không có quyền hr.employee.private (HĐ ghi lương, giấy tờ có CCCD). */
  hopDong: HdDong[] | null
  giayTo: GiayTo[] | null
  /** luong = xem lương (người quản lý lương + quản trị viên); luongSua = ghi lương trên HĐ. */
  quyen: { sua: boolean; rieng: boolean; luong: boolean; luongSua: boolean }
}

function doiCaNhan(r: DongCaNhan | null): CaNhan {
  return {
    ngaySinh: r?.birth_date ?? null,
    gioiTinh: (r?.gender as GioiTinh | null) ?? null,
    quocTich: r?.nationality ?? null,
    queQuan: r?.hometown ?? null,
    trinhDo: r?.education ?? null,
    cccdChe: cheCccd(r?.national_id ?? null),
    ngayCap: r?.id_issue_date ?? null,
    noiCap: r?.id_issue_place ?? null,
    thuongTru: r?.permanent_address ?? null,
    choO: r?.current_address ?? null,
    dienThoai: r?.phone ?? null,
    khanCapTen: r?.emergency_name ?? null,
    khanCapQuanHe: r?.emergency_relation ?? null,
    khanCapSdt: r?.emergency_phone ?? null,
  }
}

async function tomLuong(employeeId: string, thang: string): Promise<TomLuong> {
  const [ban, rieng, loai] = await Promise.all([
    hoSoLuongRepo.banTatCa(),
    hoSoLuongRepo.riengTatCa(),
    hoSoLuongRepo.loaiPhuCap(),
  ])
  const cua = ban.filter((b) => b.employeeId === employeeId)
  const b = banHieuLuc(cua, thang)
  const r = rieng.find((x) => x.employeeId === employeeId)
  const tenLoai = new Map(loai.map((l) => [l.id, l.ten]))
  return {
    thang,
    ban: b
      ? {
          tuKy: b.tuKy,
          cachTra: TEN_CACH_TRA[b.cachTra as CachTra] ?? b.cachTra,
          donGia: b.donGia,
          luongThang: b.luongThang,
          luongBh: b.luongBh,
          coBh: b.coBh,
          npt: b.npt,
          phuCap: Object.entries(b.phuCap).map(([id, muc]) => ({
            ten: tenLoai.get(id) ?? 'Phụ cấp',
            muc,
          })),
        }
      : null,
    soBan: cua.length,
    nganHang: r?.nganHang ?? null,
    stkChe: che(r?.stk),
    mstChe: che(r?.mst),
  }
}

/** Ô thuộc từng khối của tab Cá nhân — lưu khối nào chỉ chạm ô của khối đó. */
export const KHOI_CA_NHAN = {
  ca_nhan: ['birth_date', 'gender', 'nationality', 'hometown', 'education'],
  dinh_danh: [
    'national_id',
    'id_issue_date',
    'id_issue_place',
    'permanent_address',
    'current_address',
  ],
  lien_he: ['phone', 'emergency_name', 'emergency_relation', 'emergency_phone'],
} as const satisfies Record<string, readonly CotCaNhan[]>
export type KhoiCaNhan = keyof typeof KHOI_CA_NHAN
const TEN_KHOI: Record<KhoiCaNhan, string> = {
  ca_nhan: 'Cá nhân',
  dinh_danh: 'Định danh & địa chỉ',
  lien_he: 'Liên hệ',
}

/** Ngày quẹt gần nhất trong 45 ngày — chỉ đọc lượt của người này (đúng cặp máy · mã). */
async function quetGanNhat(n: NvDong, homNay: string): Promise<string | null> {
  if (!n.ma.length) return null
  const tu = new Date(`${homNay}T00:00:00Z`)
  tu.setUTCDate(tu.getUTCDate() - NV_NHIN_LAI_NGAY + 1)
  const dus = await chamCongRepo.deviceUsers()
  const cap = new Set(
    dus
      .filter((u) => n.ma.some((m) => m.id === u.id))
      .map((u) => `${u.device_id}|${u.device_user_id}`),
  )
  const logs = await chamCongRepo.logsOfCodes(
    [...new Set(n.ma.map((m) => m.ma))],
    `${tu.toISOString().slice(0, 10)}T00:00:00+07:00`,
    `${congNgay(homNay, 1)}T00:00:00+07:00`,
  )
  let cuoi: string | null = null
  for (const l of logs) {
    if (!cap.has(`${l.device_id}|${l.device_user_id}`)) continue
    const ngay = toVn(l.punched_at).slice(0, 10)
    if (!cuoi || ngay > cuoi) cuoi = ngay
  }
  return cuoi
}

/**
 * Ai đang vắng ≥ 7 ngày CÓ DỮ LIỆU (bản vẽ màu sắc 19/10/2026, Q5). Hai lượt đọc nhỏ thay
 * vì kéo 45 ngày lượt quẹt cả công ty: ① lượt từ mốc "ngày có dữ liệu thứ 7 gần nhất" tới nay
 * → ai có quẹt là không vắng; ② chỉ người còn lại mới đọc 45 ngày để biết quẹt cuối.
 * Hôm nay không tính (sáng sớm chưa ai quẹt không có nghĩa là vắng).
 */
async function vangCuaDs(ds: NvDong[], homNay: string): Promise<Map<string, VangNv>> {
  const out = new Map<string, VangNv>()
  const tu = congNgay(homNay, -NV_NHIN_LAI_NGAY + 1)
  const den = `${congNgay(homNay, 1)}T00:00:00+07:00`
  const [ngayRaw, dus] = await Promise.all([
    chamCongRepo.ngayCoLuot(`${tu}T00:00:00+07:00`, den),
    chamCongRepo.deviceUsers(),
  ])
  const ngay = [...new Set(ngayRaw)].filter((d) => d < homNay).sort()
  if (ngay.length < VANG_TU) return out
  const moc = ngay[ngay.length - VANG_TU]
  const capCua = new Map<string, string>() // device_users.id → "máy|mã"
  for (const u of dus) capCua.set(u.id, `${u.device_id}|${u.device_user_id}`)
  const ung = ds.filter(
    (n) =>
      n.active && !n.khongChamCong && n.ma.length > 0 && (!n.ngayVao || n.ngayVao <= moc),
  )
  if (!ung.length) return out
  const gan = await chamCongRepo.logsBetween(`${moc}T00:00:00+07:00`, den)
  const coQuet = new Set(gan.map((l) => `${l.device_id}|${l.device_user_id}`))
  const vang = ung.filter((n) => !n.ma.some((m) => coQuet.has(capCua.get(m.id) ?? '')))
  if (!vang.length) return out
  const cu = await chamCongRepo.logsOfCodes(
    [...new Set(vang.flatMap((n) => n.ma.map((m) => m.ma)))],
    `${tu}T00:00:00+07:00`,
    den,
  )
  const cuoiTheoCap = new Map<string, string>()
  for (const l of cu) {
    const k = `${l.device_id}|${l.device_user_id}`
    const d = toVn(l.punched_at).slice(0, 10)
    if (d > (cuoiTheoCap.get(k) ?? '')) cuoiTheoCap.set(k, d)
  }
  for (const n of vang) {
    const cuoi = n.ma.reduce<string | null>((c, m) => {
      const d = cuoiTheoCap.get(capCua.get(m.id) ?? '')
      return d && (!c || d > c) ? d : c
    }, null)
    const v = tinhVang(ngay, cuoi, n.ngayVao)
    if (v) out.set(n.id, v)
  }
  return out
}

export const hoSoNvService = {
  async danhSach(user: User, homNay: string): Promise<DsNhanVien> {
    await assertAction(user, 'hr.attendance.view')
    const [nv, co, hds] = await Promise.all([
      // Không đọc lượt quẹt 45 ngày cả công ty — "vắng" đọc riêng, gọn hơn (vangCuaDs).
      chamCongService.nhanVien(user, homNay, { luot: false }),
      caNhanRepo.coTatCa(),
      hopDongRepo.ngayTatCa(),
    ])
    const vang = await vangCuaDs(nv.ds, homNay)
    const hdCua = new Map<string, HdNgay[]>()
    for (const h of hds)
      hdCua.set(h.employeeId, [...(hdCua.get(h.employeeId) ?? []), h.hd])
    return {
      ...nv,
      ds: nv.ds.map((n) => ({
        ...n,
        coRieng: co.get(n.id) ?? KHONG_CO_RIENG,
        hd: hdHienHanh(hdCua.get(n.id) ?? [], homNay),
        vang: vang.get(n.id) ?? null,
      })),
    }
  },

  async trang(user: User, ma: string): Promise<HoSoNvTrang> {
    await assertAction(user, 'hr.attendance.view')
    const homNay = todayVn()
    const [nv, sua, rieng, luong, luongSua] = await Promise.all([
      this.danhSach(user, homNay),
      canAction(user, 'hr.attendance.employee_edit'),
      canAction(user, XEM_RIENG),
      xemLuong(user),
      suaLuong(user),
    ])
    const n = nv.ds.find((x) => x.code === ma)
    if (!n) throw NotFound(`Không có nhân viên mã ${ma}`)
    const thang = thangCuaNgay(homNay)
    const k = kyCuaThang(thang)
    const den = k.den < homNay ? k.den : homNay
    const [bienDong, mot, caNhan, tl, lanCuoi, hopDong, giayTo] = await Promise.all([
      bienDongRepo.cuaNguoi(n.id),
      n.khongChamCong || den < k.tu
        ? null
        : chamCongService.motNguoi(user, ma, { tu: k.tu, den }),
      rieng ? caNhanRepo.cua(n.id) : null,
      luong
        ? hoSoLuongRepo
            .ghiXemLuong('salary_tab', user.id, { employeeId: n.id })
            .then(() => tomLuong(n.id, thang))
        : null,
      quetGanNhat(n, homNay),
      rieng
        ? hopDongRepo
            .cuaNguoi(n.id)
            // Lương trên HĐ là số mật: không có quyền lương thì không gửi xuống trình duyệt.
            .then((ds) => (luong ? ds : ds.map((h) => ({ ...h, luong: null }))))
        : null,
      rieng ? hopDongService.giayTo(user, n.id) : null,
    ])
    n.lanCuoi = lanCuoi
    const ngayDaLay = mot?.ngay.filter((d) => d.daLay) ?? []
    return {
      n,
      bienDong,
      cas: nv.cas,
      boPhan: nv.boPhan,
      chucDanh: [
        ...new Set(nv.ds.map((x) => x.chucDanh).filter((t): t is string => !!t)),
      ].sort((a, b) => a.localeCompare(b, 'vi')),
      dsMa: nv.ds
        .filter((x) => x.active)
        .map((x) => x.code)
        .sort(soSanhMa),
      homNay,
      ky: {
        thang,
        tu: k.tu,
        den: k.den,
        coQuet: mot ? ngayDaLay.filter((d) => d.luot.length > 0).length : null,
        daLay: ngayDaLay.length,
      },
      caNhan: rieng ? doiCaNhan(caNhan) : null,
      luong: tl,
      hopDong,
      giayTo,
      quyen: { sua, rieng, luong, luongSua },
    }
  },

  /**
   * Lưu một khối của tab Cá nhân. Số CCCD bỏ trống = giữ số cũ (ô sửa không hiện số thật).
   * Ghi biến động 'edit' kèm TÊN ô đổi — không ghi giá trị.
   */
  async luuCaNhan(
    user: User,
    employeeId: string,
    khoi: KhoiCaNhan,
    v: Partial<Record<CotCaNhan, string | null>>,
  ): Promise<void> {
    await assertAction(user, XEM_RIENG)
    const cu = await caNhanRepo.cua(employeeId)
    const patch: Partial<DongCaNhan> = {}
    for (const cot of KHOI_CA_NHAN[khoi] as readonly CotCaNhan[]) {
      if (!(cot in v)) continue
      let gia = v[cot]?.trim() || null
      if (cot === 'national_id') {
        if (gia == null) continue
        const c = chuanCccd(gia)
        if (c === undefined) throw BadRequest('Số CCCD có 12 chữ số (CMND cũ 9 chữ số)')
        gia = c
      }
      if (cot === 'phone' || cot === 'emergency_phone') {
        const s = gia == null ? null : chuanSdt(gia)
        if (s === undefined)
          throw BadRequest(
            `${COT_CA_NHAN[cot]} chưa đúng: số Việt Nam 10 chữ số, bắt đầu bằng 0`,
          )
        gia = s
      }
      if (cot === 'gender' && gia != null && gia !== 'male' && gia !== 'female')
        throw BadRequest('Giới tính không hợp lệ')
      if (cot === 'birth_date' && gia && gia > todayVn())
        throw BadRequest('Ngày sinh sau hôm nay')
      if ((cu?.[cot] ?? null) !== gia) patch[cot] = gia
    }
    const doi = Object.keys(patch) as CotCaNhan[]
    if (!doi.length) return
    await caNhanRepo.luu(employeeId, patch, user.id)
    await bienDongRepo.ghi({
      employeeId,
      loai: 'edit',
      ngay: todayVn(),
      ghiChu: `${TEN_KHOI[khoi]}: ${doi.map((c) => COT_CA_NHAN[c]).join(', ')}`,
      truoc: { doi },
      userId: user.id,
    })
  },

  /** Số CCCD thật — sau khi ghi vết người xem (hr_private_access_log). */
  async hienCccd(user: User, employeeId: string): Promise<string | null> {
    await assertAction(user, XEM_RIENG)
    await hoSoLuongRepo.ghiXem(employeeId, 'national_id', user.id)
    return (await caNhanRepo.cua(employeeId))?.national_id ?? null
  },
}
