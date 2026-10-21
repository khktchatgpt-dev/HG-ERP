import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { thangCuaNgay } from '@/lib/cham-cong/ky-gio-cong'
import {
  banHieuLuc,
  che,
  chuanNganHang,
  docDan,
  docSo,
  khopNguoi,
  thieu,
  type CachTra,
  type CotNap,
  type KetQuaKhop,
  type CachPhuCapDong,
  type ThieuThongTin,
} from '@/lib/luong/ho-so-luong'
import { TY_LE_BH_NLD } from '@/lib/luong/tinh-luong'
import { chamCongRepo } from '../cham-cong/cham-cong.repo'
import { hoSoLuongRepo, type BanLuong, type LoaiPhuCap } from './ho-so-luong.repo'
import { assertXemLuong, suaLuong } from './quyen-luong'

/**
 * HỒ SƠ LƯƠNG (B4, bản vẽ duyệt 18/10/2026, Q1–Q7 theo đề xuất). Danh mục có hiệu lực theo
 * kỳ — chép Odoo Contract / SAP infotype 0008. Mọi hàm gác `hr.payroll.profile` — quyền MẬT
 * (0255), chỉ vai "Quản lý lương"; người khác không đọc được lương lẫn định danh.
 *
 * Bản có từ-kỳ ≤ kỳ đã chốt gần nhất (B3) là đã dùng để tính → chỉ xem; đổi thì thêm bản
 * từ kỳ sau. Số tài khoản, CCCD, MST trả về đã CHE; "Hiện" ghi vết rồi mới trả số thật.
 */

const QUYEN = 'hr.payroll.profile'

export type DongHoSo = {
  employeeId: string
  ma: string
  ten: string
  to: string | null
  khongCham: boolean
  ban: BanLuong | null
  soBan: number
  doiTuKyNay: boolean
  khoa: boolean
  thieu: ThieuThongTin
  nganHang: string | null
  stkChe: string | null
}

export type HoSoTrang = {
  thang: string
  kyChotCuoi: string | null
  dong: DongHoSo[]
  loaiPhuCap: LoaiPhuCap[]
  to: string[]
  /** Quản trị viên chỉ XEM (20/10) — giao diện ẩn / khoá mọi nút ghi. */
  quyen: { sua: boolean }
}

export type ChiTiet = {
  employeeId: string
  lichSu: (BanLuong & { khoa: boolean })[]
  rieng: {
    nganHang: string | null
    stk: string | null
    cccd: string | null
    mst: string | null
    ngayVao: string | null
  }
  lanXem: { truong: string; boi: string | null; luc: string }[]
}

export type BanNhap = {
  tuKy: string
  cachTra: CachTra
  donGia: number | null
  luongThang: number | null
  luongBh: number | null
  coBh: boolean
  npt: number
  khauTru10: boolean
  ghiChu: string | null
  phuCap: Record<string, number>
  /** 0254 — thiếu thì giữ mặc định: theo hệ số khung, có trừ đoàn phí, phụ cấp chia công chuẩn. */
  tangCaGio?: number | null
  doanPhi?: boolean
  phuCapCach?: Record<string, CachPhuCapDong>
}

/**
 * Người có thể còn lương phải tính: đang làm, hoặc đã nghỉ mà ngày làm cuối nằm sau kỳ chốt
 * gần nhất (kỳ đó chưa chốt → bảng lương kỳ đó còn có họ, 0248).
 */
async function nhanVien() {
  const [emps, kyChot] = await Promise.all([
    chamCongRepo.employees(),
    hoSoLuongRepo.kyChotCuoi(),
  ])
  const tuKyMo = kyChot ? `${kyChot}-25` : ''
  return emps.filter((e) => e.active || (!!e.leave_date && e.leave_date > tuKyMo))
}

function kiemKy(tuKy: string, kyChot: string | null) {
  if (kyChot && tuKy <= kyChot)
    throw Conflict(
      `Kỳ ${tuKy.slice(5)}/${tuKy.slice(0, 4)} đã chốt — hồ sơ lương chỉ đổi được từ kỳ sau kỳ ${kyChot.slice(5)}/${kyChot.slice(0, 4)}`,
    )
}

function kiemBan(v: BanNhap) {
  if (v.cachTra === 'daily' && v.donGia == null)
    throw BadRequest('Theo công thì cần đơn giá một công')
  if (v.cachTra === 'monthly' && v.luongThang == null)
    throw BadRequest('Theo tháng thì cần lương tháng')
}

export type DongXemNap = {
  dong: number
  /** Mã NV ghi trong file (sổ lương) — để người soi đối chiếu với người được khớp. */
  ma: string | null
  ten: string
  to: string | null
  khop: KetQuaKhop
  giaTri: Partial<Record<CotNap, string>>
}

export const hoSoLuongService = {
  async trang(user: User, thang?: string): Promise<HoSoTrang> {
    await assertXemLuong(user)
    const ky = thang ?? thangCuaNgay(todayVn())
    await hoSoLuongRepo.ghiXemLuong('payroll_list', user.id, { ghiChu: `kỳ ${ky}` })
    const [emps, ban, rieng, loai, kyChot] = await Promise.all([
      nhanVien(),
      hoSoLuongRepo.banTatCa(),
      hoSoLuongRepo.riengTatCa(),
      hoSoLuongRepo.loaiPhuCap(),
      hoSoLuongRepo.kyChotCuoi(),
    ])
    const banCua = new Map<string, BanLuong[]>()
    for (const b of ban)
      banCua.set(b.employeeId, [...(banCua.get(b.employeeId) ?? []), b])
    const riengCua = new Map(rieng.map((r) => [r.employeeId, r]))
    const dong: DongHoSo[] = emps.map((e) => {
      const ds = banCua.get(e.id) ?? []
      const b = banHieuLuc(ds, ky)
      const r = riengCua.get(e.id)
      return {
        employeeId: e.id,
        ma: e.code,
        ten: e.full_name,
        to: e.team,
        khongCham: e.attendance_exempt,
        ban: b,
        soBan: ds.length,
        doiTuKyNay: !!b && b.tuKy === ky,
        khoa: !!b && !!kyChot && b.tuKy <= kyChot,
        thieu: thieu(b, r?.stk),
        nganHang: r?.nganHang ?? null,
        stkChe: che(r?.stk)?.slice(-8) ?? null,
      }
    })
    dong.sort((a, b) => a.ma.localeCompare(b.ma, 'vi', { numeric: true }))
    return {
      thang: ky,
      kyChotCuoi: kyChot,
      dong,
      quyen: { sua: await suaLuong(user) },
      loaiPhuCap: loai,
      to: [...new Set(emps.map((e) => e.team).filter((t): t is string => !!t))].sort(
        (a, b) => a.localeCompare(b, 'vi'),
      ),
    }
  },

  async chiTiet(user: User, employeeId: string): Promise<ChiTiet> {
    await assertXemLuong(user)
    await hoSoLuongRepo.ghiXemLuong('payroll_profile', user.id, { employeeId })
    const [ban, rieng, lanXem, kyChot] = await Promise.all([
      hoSoLuongRepo.banTatCa(),
      hoSoLuongRepo.riengTatCa(),
      hoSoLuongRepo.lanXem(employeeId),
      hoSoLuongRepo.kyChotCuoi(),
    ])
    const r = rieng.find((x) => x.employeeId === employeeId)
    return {
      employeeId,
      lichSu: ban
        .filter((b) => b.employeeId === employeeId)
        .sort((a, b) => (a.tuKy < b.tuKy ? 1 : -1))
        .map((b) => ({ ...b, khoa: !!kyChot && b.tuKy <= kyChot })),
      rieng: {
        nganHang: r?.nganHang ?? null,
        stk: che(r?.stk),
        cccd: che(r?.cccd),
        mst: che(r?.mst),
        // Ngày vào: nguồn duy nhất là hồ sơ nhân viên (0248) — ở đây chỉ đọc.
        ngayVao:
          (await chamCongRepo.employees()).find((e) => e.id === employeeId)?.hire_date ??
          null,
      },
      lanXem,
    }
  },

  /** Trả số thật của một ô định danh — sau khi ghi vết người xem. */
  async hien(
    user: User,
    employeeId: string,
    truong: 'bank_account' | 'national_id' | 'tax_code',
  ): Promise<string | null> {
    await assertXemLuong(user)
    const r = (await hoSoLuongRepo.riengTatCa()).find((x) => x.employeeId === employeeId)
    await hoSoLuongRepo.ghiXem(employeeId, truong, user.id)
    if (!r) return null
    return truong === 'bank_account' ? r.stk : truong === 'national_id' ? r.cccd : r.mst
  },

  async luuBan(user: User, employeeId: string, v: BanNhap): Promise<void> {
    await assertAction(user, QUYEN)
    kiemBan(v)
    kiemKy(v.tuKy, await hoSoLuongRepo.kyChotCuoi())
    if (!(await nhanVien()).some((e) => e.id === employeeId))
      throw NotFound('Không có nhân viên này')
    await hoSoLuongRepo.luuBan(
      {
        ...v,
        tangCaGio: v.tangCaGio ?? null,
        doanPhi: v.doanPhi ?? true,
        phuCapCach: v.phuCapCach ?? {},
        employeeId,
        nguon: 'nhập tay',
      },
      user.id,
    )
  },

  async luuRieng(
    user: User,
    employeeId: string,
    v: {
      cccd?: string | null
      mst?: string | null
      nganHang?: string | null
      stk?: string | null
    },
  ): Promise<void> {
    await assertAction(user, QUYEN)
    await hoSoLuongRepo.luuRieng(
      employeeId,
      { ...v, ...(v.nganHang !== undefined && { nganHang: chuanNganHang(v.nganHang) }) },
      user.id,
    )
  },

  /** Đặt một đơn giá cho mọi người của tổ (mặc định chỉ người chưa có đơn giá ở kỳ đó). */
  async datDonGiaTo(
    user: User,
    v: { to: string; tuKy: string; donGia: number; ghiDe: boolean },
  ): Promise<number> {
    await assertAction(user, QUYEN)
    kiemKy(v.tuKy, await hoSoLuongRepo.kyChotCuoi())
    const [emps, ban] = await Promise.all([nhanVien(), hoSoLuongRepo.banTatCa()])
    let so = 0
    for (const e of emps.filter((x) => x.team === v.to)) {
      const cu = banHieuLuc(
        ban.filter((b) => b.employeeId === e.id),
        v.tuKy,
      )
      const coDonGia = cu?.cachTra === 'daily' && cu.donGia != null
      if (cu?.cachTra === 'monthly' || (coDonGia && !v.ghiDe)) continue
      await hoSoLuongRepo.luuBan(
        {
          employeeId: e.id,
          tuKy: v.tuKy,
          cachTra: 'daily',
          donGia: v.donGia,
          luongThang: null,
          luongBh: cu?.luongBh ?? null,
          coBh: cu?.coBh ?? true,
          npt: cu?.npt ?? 0,
          khauTru10: cu?.khauTru10 ?? false,
          ghiChu: cu?.ghiChu ?? null,
          nguon: `đơn giá cả tổ ${v.to}`,
          phuCap: cu?.phuCap ?? {},
          tangCaGio: cu?.tangCaGio ?? null,
          doanPhi: cu?.doanPhi ?? true,
          phuCapCach: cu?.phuCapCach ?? {},
        },
        user.id,
      )
      so++
    }
    return so
  },

  /** Đọc vùng dán, khớp từng dòng với nhân viên — KHÔNG ghi gì. */
  async napXem(user: User, text: string): Promise<{ cot: CotNap[]; dong: DongXemNap[] }> {
    await assertAction(user, QUYEN)
    const { cot, dong } = docDan(text)
    if (!cot.includes('ten'))
      throw BadRequest(
        'Không thấy cột Họ tên — dán cả dòng tiêu đề của file (VD "TÊN NGƯỜI THỤ HƯỞNG")',
      )
    const ds = (await nhanVien()).map((e) => ({
      id: e.id,
      ma: e.code,
      ten: e.full_name,
      to: e.team,
    }))
    return {
      cot,
      dong: dong.map((d) => {
        const { dong: so, ma, ten, to, ...giaTri } = d
        return {
          dong: so,
          ma: ma ?? null,
          ten: ten!,
          to: to ?? null,
          khop: khopNguoi(ma, ten!, to ?? null, ds),
          giaTri,
        }
      }),
    }
  },

  /** Ghi các dòng đã chọn người. Ô có giá trị mới ghi; lương ghép vào bản hiệu lực từ `tuKy`. */
  async napGhi(
    user: User,
    tuKy: string,
    dong: { employeeId: string; giaTri: Partial<Record<CotNap, string>> }[],
  ): Promise<{ hoSo: number; rieng: number }> {
    await assertAction(user, QUYEN)
    const coLuong = dong.some(
      (d) =>
        d.giaTri.donGia ||
        d.giaTri.luongThang ||
        d.giaTri.luongBh ||
        d.giaTri.truBh ||
        d.giaTri.npt,
    )
    if (coLuong) kiemKy(tuKy, await hoSoLuongRepo.kyChotCuoi())
    const ban = coLuong ? await hoSoLuongRepo.banTatCa() : []
    let hoSo = 0
    let rieng = 0
    for (const d of dong) {
      const g = d.giaTri
      const stk = g.stk?.replace(/[\s.-]/g, '')
      if (g.stk || g.nganHang || g.cccd || g.mst) {
        await hoSoLuongRepo.luuRieng(
          d.employeeId,
          {
            ...(stk && { stk }),
            ...(g.nganHang && { nganHang: chuanNganHang(g.nganHang) }),
            ...(g.cccd && { cccd: g.cccd.replace(/\D/g, '') }),
            ...(g.mst && { mst: g.mst.replace(/\D/g, '') }),
          },
          user.id,
        )
        rieng++
      }
      const donGia = docSo(g.donGia)
      const luongThang = docSo(g.luongThang)
      // Sổ lương ghi số TIỀN trừ BH, không ghi mức đóng: 415.800 ÷ 10,5 % = 3.960.000; trừ 0 = không đóng.
      const truBh = docSo(g.truBh)
      const luongBh =
        docSo(g.luongBh) ??
        (truBh != null && truBh > 0 ? Math.round(truBh / TY_LE_BH_NLD) : null)
      const coBh = truBh != null ? truBh > 0 : null
      // Sổ lương: người đóng BH mà ô "Công đoàn" = 0 là không trừ đoàn phí (T9: 2 người).
      const dp = docSo(g.doanPhi)
      const doanPhi = dp != null && coBh ? dp > 0 : null
      const npt = docSo(g.npt)
      if (
        donGia == null &&
        luongThang == null &&
        luongBh == null &&
        npt == null &&
        coBh == null
      )
        continue
      const cu = banHieuLuc(
        ban.filter((b) => b.employeeId === d.employeeId),
        tuKy,
      )
      const cachTra: CachTra =
        luongThang != null
          ? 'monthly'
          : donGia != null
            ? 'daily'
            : (cu?.cachTra ?? 'daily')
      const v = {
        employeeId: d.employeeId,
        tuKy,
        cachTra,
        donGia: donGia ?? cu?.donGia ?? null,
        luongThang: luongThang ?? cu?.luongThang ?? null,
        luongBh: luongBh ?? cu?.luongBh ?? null,
        coBh: coBh ?? cu?.coBh ?? true,
        npt: npt ?? cu?.npt ?? 0,
        khauTru10: cu?.khauTru10 ?? false,
        ghiChu: cu?.ghiChu ?? null,
        nguon: 'nạp Excel',
        phuCap: cu?.phuCap ?? {},
        tangCaGio: cu?.tangCaGio ?? null,
        doanPhi: doanPhi ?? cu?.doanPhi ?? true,
        phuCapCach: cu?.phuCapCach ?? {},
      }
      // Chỉ có lương BH / NPT mà chưa có đơn giá hay lương tháng thì chưa thành bản được.
      if (
        (v.cachTra === 'daily' && v.donGia == null) ||
        (v.cachTra === 'monthly' && v.luongThang == null)
      )
        continue
      await hoSoLuongRepo.luuBan(v, user.id)
      hoSo++
    }
    return { hoSo, rieng }
  },

  async luuLoaiPhuCap(
    user: User,
    v: {
      id?: string
      ten: string
      tinhBh: boolean
      chiuThue: boolean
      dangDung: boolean
    },
  ): Promise<void> {
    await assertAction(user, QUYEN)
    await hoSoLuongRepo.luuLoaiPhuCap(v)
  },
}
