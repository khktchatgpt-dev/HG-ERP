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
import { kyCuaThang, thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import { soSanhMa } from '@/lib/nhan-su/ho-so'
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
import { chamCongService, type NhanVienData, type NvDong } from './cham-cong.service'
import { bienDongRepo, type BienDongDong } from './bien-dong.repo'
import { caNhanRepo, COT_CA_NHAN, type CotCaNhan, type DongCaNhan } from './ca-nhan.repo'
import { hoSoLuongRepo } from '../luong/ho-so-luong.repo'

const XEM_RIENG = 'hr.employee.private'
const XEM_LUONG = 'hr.payroll.profile'

export type NvHoSo = NvDong & { coRieng: CoRieng }

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
  quyen: { sua: boolean; rieng: boolean; luong: boolean }
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

export const hoSoNvService = {
  async danhSach(user: User, homNay: string): Promise<DsNhanVien> {
    await assertAction(user, 'hr.attendance.view')
    const [nv, co] = await Promise.all([
      chamCongService.nhanVien(user, homNay),
      caNhanRepo.coTatCa(),
    ])
    return {
      ...nv,
      ds: nv.ds.map((n) => ({ ...n, coRieng: co.get(n.id) ?? KHONG_CO_RIENG })),
    }
  },

  async trang(user: User, ma: string): Promise<HoSoNvTrang> {
    await assertAction(user, 'hr.attendance.view')
    const homNay = todayVn()
    const [nv, sua, rieng, luong] = await Promise.all([
      this.danhSach(user, homNay),
      canAction(user, 'hr.attendance.employee_edit'),
      canAction(user, XEM_RIENG),
      canAction(user, XEM_LUONG),
    ])
    const n = nv.ds.find((x) => x.code === ma)
    if (!n) throw NotFound(`Không có nhân viên mã ${ma}`)
    const thang = thangCuaNgay(homNay)
    const k = kyCuaThang(thang)
    const den = k.den < homNay ? k.den : homNay
    const [bienDong, mot, caNhan, tl] = await Promise.all([
      bienDongRepo.cuaNguoi(n.id),
      n.khongChamCong || den < k.tu
        ? null
        : chamCongService.motNguoi(user, ma, { tu: k.tu, den }),
      rieng ? caNhanRepo.cua(n.id) : null,
      luong ? tomLuong(n.id, thang) : null,
    ])
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
      quyen: { sua, rieng, luong },
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
