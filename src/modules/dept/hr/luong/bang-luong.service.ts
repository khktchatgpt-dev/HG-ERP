import type { User } from '@/modules/core/users/users.repo'
import '@/events/register' // Đăng ký handler event ở lần import đầu tiên.
import { emit } from '@/events/bus'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden } from '@/server/http'
import { banHieuLuc, CACH_PC_MAC_DINH } from '@/lib/luong/ho-so-luong'
import { khoangTrongKy } from '@/lib/nhan-su/bien-dong'
import {
  congChuan,
  tinhPhieu,
  type LoaiKhoan,
  type LoaiNgayLuong,
  type MaNghi,
} from '@/lib/luong/tinh-luong'
import { congNgay } from '@/lib/cham-cong/ky-gio-cong'
import { chamCongRepo } from '../cham-cong/cham-cong.repo'
import { cachTinhRepo } from '../cham-cong/cach-tinh.repo'
import { kyCongRepo, type KyDong } from '../cham-cong/ky-cong.repo'
import { hoSoLuongRepo } from './ho-so-luong.repo'
import { assertXemLuong } from './quyen-luong'
import {
  bangLuongRepo,
  type BangDong,
  type KhoanDong,
  type PhieuDong,
  type SuKienLuong,
} from './bang-luong.repo'

/**
 * BẢNG LƯƠNG THEO KỲ (B5, bản vẽ duyệt 18/10/2026, Q1–Q8 theo đề xuất) — chứng từ:
 *   nháp → chờ duyệt → đã duyệt → đã chi; trả lại / rút về nháp bắt lý do.
 * Tính từ ba nguồn đã khoá: bản chốt kỳ công × hồ sơ lương × hệ số của bản cách tính mà kỳ
 * công đã dùng lúc chốt. Bảng lương không sửa giờ hay đơn giá — sai thì sửa ở nguồn, Tính lại.
 * Sau khi chi: không sửa; chênh lệch ghi khoản "Truy lĩnh / Truy thu" ở kỳ sau.
 */

const CHAY = 'hr.payroll.run'
const DUYET = 'hr.payroll.approve'

export type DieuKienGui = { ma: string; ten: string; ok: boolean; chiTiet: string }

export type BangLuongTrang = {
  thang: string
  ky: KyDong | null
  bang: BangDong | null
  phieu: PhieuDong[]
  khoan: KhoanDong[]
  suKien: SuKienLuong[]
  congChuan: number | null
  /** Bảng đã tính nhưng nguồn đổi sau đó (kỳ công chốt lại, khoản theo kỳ thêm / xoá). */
  canTinhLai: boolean
  dieuKien: DieuKienGui[]
  nhanVien: { id: string; ma: string; ten: string }[]
  quyen: { chay: boolean; duyet: boolean }
}

const dmy = (t: string) => `${t.slice(5)}/${t.slice(0, 4)}`

function dieuKienGui(phieu: PhieuDong[], canTinhLai: boolean): DieuKienGui[] {
  const dem = (re: RegExp) => phieu.filter((p) => p.van.some((v) => re.test(v))).length
  const thieuHeSo = [
    ...new Set(phieu.flatMap((p) => p.van.filter((v) => v.startsWith('Thiếu hệ số')))),
  ]
  return [
    {
      ma: 'tinh_lai',
      ten: 'Số đang khớp nguồn',
      ok: !canTinhLai,
      chiTiet: canTinhLai ? 'nguồn đã đổi sau lần tính — bấm Tính lại' : 'khớp',
    },
    {
      ma: 'ho_so',
      ten: 'Ai cũng có hồ sơ lương',
      ok: dem(/^Chưa có hồ sơ lương/) === 0,
      chiTiet: `${dem(/^Chưa có hồ sơ lương/)} người chưa có`,
    },
    {
      ma: 'stk',
      ten: 'Ai cũng có STK',
      ok: dem(/^Thiếu STK/) === 0,
      chiTiet: `${dem(/^Thiếu STK/)} người thiếu`,
    },
    {
      ma: 'he_so',
      ten: 'Hệ số khung có giờ',
      ok: thieuHeSo.length === 0,
      chiTiet: thieuHeSo.length
        ? thieuHeSo.map((v) => v.replace('Thiếu hệ số ', '')).join(', ')
        : 'đủ',
    },
    {
      ma: 'am',
      ten: 'Không thực lĩnh âm',
      ok: dem(/^Thực lĩnh âm/) === 0,
      chiTiet: `${dem(/^Thực lĩnh âm/)} phiếu`,
    },
  ]
}

async function nap(thang: string) {
  const [ky, bang, khoan] = await Promise.all([
    kyCongRepo.ky(thang),
    bangLuongRepo.bang(thang),
    bangLuongRepo.khoan(thang),
  ])
  const phieu =
    bang && bang.lanTinh ? await bangLuongRepo.phieu(bang.id, bang.lanTinh) : []
  const khoanMoi = khoan.reduce((m, k) => (k.luc > m ? k.luc : m), '')
  const canTinhLai =
    !!bang &&
    bang.lanTinh > 0 &&
    bang.trangThai === 'draft' &&
    (!ky ||
      ky.trangThai !== 'closed' ||
      ky.lanChot !== bang.lanChotCong ||
      (!!khoanMoi && !!bang.tinhLuc && khoanMoi > bang.tinhLuc))
  return { ky, bang, khoan, phieu, canTinhLai }
}

/**
 * LÕI tính bảng lương — không kiểm quyền (người gọi đã kiểm, hoặc là HỆ THỐNG tự tính khi
 * Nhân sự chốt kỳ công, 21/10/2026). `nguoiTinh` null = hệ thống: màn Bảng lương bày "Tính
 * tự động" thay tên người.
 */
/** Kết quả một lần tính: số người, tổng thực lĩnh, số phiếu còn vướng (thiếu hồ sơ / hệ số / STK). */
export type KetQuaTinh = { nguoi: number; thucLinh: number; vuong: number }

async function tinhLoi(thang: string, nguoiTinh: string | null): Promise<KetQuaTinh> {
  const ky = await kyCongRepo.ky(thang)
  if (!ky || ky.trangThai !== 'closed')
    throw Conflict(
      `Kỳ công ${dmy(thang)} chưa chốt — chốt ở màn Kỳ công trước khi tính lương`,
    )
  const bang = await bangLuongRepo.damBao(thang)
  if (bang.trangThai !== 'draft')
    throw Conflict('Bảng lương đã gửi duyệt — rút về nháp trước khi tính lại')
  if (!ky.banCachTinhId)
    throw Conflict('Kỳ công chốt không ghi bản cách tính — chốt lại kỳ công')

  const [chot, emps, ban, rieng, loaiPc, khung, heSo, quyTacBan, leRows, khoan, ts] =
    await Promise.all([
      kyCongRepo.banChot(ky.id, ky.lanChot),
      chamCongRepo.employees(),
      hoSoLuongRepo.banTatCa(),
      hoSoLuongRepo.riengTatCa(),
      hoSoLuongRepo.loaiPhuCap(),
      cachTinhRepo.khung(ky.banCachTinhId),
      cachTinhRepo.heSo(ky.banCachTinhId),
      cachTinhRepo.dsBan(),
      chamCongRepo.holidays(ky.tu, congNgay(ky.den, 1)),
      bangLuongRepo.khoan(thang),
      cachTinhRepo.thamSoLuong(ky.banCachTinhId),
    ])
  const quyTac = quyTacBan.find((b) => b.id === ky.banCachTinhId)?.quyTac
  if (!quyTac) throw Conflict('Không tìm thấy bản cách tính kỳ công đã dùng')
  const ngayLe = leRows
    .map((h) => h.holiday_date)
    .filter((d) => new Date(`${d}T00:00:00Z`).getUTCDay() !== 0)
  const le = new Set(ngayLe)
  // KT luôn chia 26 (0254); bản không đặt thì đếm ngày kỳ trừ CN, lễ như trước.
  const cc = ts.congChuan ?? congChuan(ky.tu, ky.den, ngayLe)
  const rate = new Map(heSo.map((h) => [`${h.loai}|${h.ma}|${h.ngay}`, h.pt]))
  const boiCanh = {
    thang,
    phutMotCong: quyTac.phutMotCong,
    khung: khung.map((k) => ({ ma: k.ma, ten: k.ten, hanhChinh: k.hanhChinh })),
    congChuan: cc,
    ngayLe,
    loaiNgay: (d: string): LoaiNgayLuong =>
      le.has(d) ? 'le' : new Date(`${d}T00:00:00Z`).getUTCDay() === 0 ? 'cn' : 'thuong',
    heSoKhung: (ma: string, n: LoaiNgayLuong) => rate.get(`frame|${ma}|${n}`) ?? null,
    heSoNghi: (ma: MaNghi) => rate.get(`leave|${ma}|any`) ?? null,
    heSoTrua: quyTac.heSoTrua,
    ptTrua: ts.ptTrua,
    truThue: ts.truThue,
  }
  const empByCode = new Map(emps.map((e) => [e.code, e]))
  const riengCua = new Map(rieng.map((r) => [r.employeeId, r]))
  const loaiCua = new Map(loaiPc.map((l) => [l.id, l]))
  const theoNguoi = new Map<string, typeof chot>()
  for (const c of chot) theoNguoi.set(c.ma, [...(theoNguoi.get(c.ma) ?? []), c])

  const phieu: PhieuDong[] = []
  for (const [ma, ds] of theoNguoi) {
    const e = empByCode.get(ma)
    if (!e) continue
    const van: string[] = []
    const hs = banHieuLuc(
      ban.filter((b) => b.employeeId === e.id),
      thang,
    )
    const r = riengCua.get(e.id)
    if (!hs) van.push('Chưa có hồ sơ lương')
    if (!r?.stk) van.push('Thiếu STK')
    // Không chấm công: số công = công chuẩn của PHẦN kỳ còn làm (vào / nghỉ giữa kỳ, 0248).
    const khoang = khoangTrongKy(
      { hireDate: e.hire_date, leaveDate: e.leave_date },
      ky.tu,
      ky.den,
    )
    // Làm trọn kỳ = đủ công chuẩn (`true`): công chuẩn cố định 26 mà kỳ chỉ 25 ngày làm thì
    // đếm ngày sẽ trả thiếu 1/26.
    const mien = ds.some((x) => x.miem)
      ? khoang
        ? khoang.tu === ky.tu && khoang.den === ky.den
          ? true
          : congChuan(khoang.tu, khoang.den, ngayLe)
        : 0
      : false
    const p = tinhPhieu(
      hs
        ? {
            cachTra: hs.cachTra,
            donGia: hs.donGia,
            luongThang: hs.luongThang,
            luongBh: hs.luongBh,
            coBh: hs.coBh,
            npt: hs.npt,
            khauTru10: hs.khauTru10,
            tangCaGio: hs.tangCaGio,
            doanPhi: hs.doanPhi,
            phuCap: Object.entries(hs.phuCap)
              .map(([id, muc]) => ({ id, l: loaiCua.get(id), muc }))
              .filter((x) => x.l)
              .map(({ id, l, muc }) => ({
                ten: l!.ten,
                muc,
                chiuThue: l!.chiuThue,
                theoNgay: l!.theoNgay,
                ...(hs.phuCapCach[id] ?? CACH_PC_MAC_DINH),
              })),
          }
        : {
            cachTra: 'daily',
            donGia: 0,
            luongThang: null,
            luongBh: null,
            coBh: false,
            npt: 0,
            khauTru10: false,
            tangCaGio: null,
            doanPhi: false,
            phuCap: [],
          },
      ds
        .filter((x) => !x.miem && x.ngay)
        .map((x) => ({
          ngay: x.ngay!,
          k: x.k,
          trua: x.truaCong,
          nghi: x.nghi as MaNghi | null,
          khong: x.khong,
        })),
      khoan
        .filter((k) => k.employeeId === e.id)
        .map((k) => ({ loai: k.loai, tien: k.tien })),
      boiCanh,
      mien,
    )
    van.push(...p.thieuHeSo.map((t) => `Thiếu hệ số ${t}`), ...p.canhBao)
    phieu.push({
      employeeId: e.id,
      ma,
      ten: ds[0].ten,
      to: ds[0].to,
      cachTra: hs?.cachTra ?? '—',
      cong: p.congThuc,
      luongCong: p.luongCong,
      tangCa: p.tangCa,
      nghiCoLuong: p.nghiCoLuong,
      phuCap: p.phuCap,
      khoanCong: p.khoanCong,
      tong: p.tong,
      bhNld: p.bhNld,
      bhDn: p.bhDn,
      kpcd: p.kpcd,
      doanPhi: p.doanPhi,
      thue: p.thue,
      truThue: p.truThue,
      khoanTru: p.khoanTru,
      thucLinh: p.thucLinh,
      nganHang: r?.nganHang ?? null,
      stk: r?.stk ?? null,
      dong: p.dong,
      why: p.why,
      van,
    })
  }
  const lan = bang.lanTinh + 1
  await bangLuongRepo.ghiPhieu(bang.id, lan, phieu)
  const ok = await bangLuongRepo.doi(bang.id, 'draft', {
    calc_count: lan,
    time_close_no: ky.lanChot,
    calc_version_id: ky.banCachTinhId,
    calculated_by: nguoiTinh,
    calculated_at: new Date().toISOString(),
  })
  if (!ok) throw Conflict('Bảng lương vừa đổi trạng thái — tải lại trang')
  const thucLinh = phieu.reduce((s, p) => s + p.thucLinh, 0)
  await bangLuongRepo.ghiSuKien(bang.id, 'calculate', nguoiTinh, null, {
    lan,
    nguoi: phieu.length,
    thucLinh,
  })
  return {
    nguoi: phieu.length,
    thucLinh,
    vuong: phieu.filter((p) => p.van.length).length,
  }
}

export const bangLuongService = {
  /** Dữ liệu cho file Excel lương — như `trang`, ghi thêm nhật ký "xuất Excel". */
  async xuatExcel(user: User, thang: string): Promise<BangLuongTrang> {
    const b = await this.trang(user, thang)
    await hoSoLuongRepo.ghiXemLuong('payroll_excel', user.id, { ghiChu: `kỳ ${thang}` })
    return b
  },

  async trang(user: User, thang: string): Promise<BangLuongTrang> {
    // Xem: người quản lý lương + quản trị viên (chỉ đọc, 20/10); tính / gửi / chi gác CHAY.
    await assertXemLuong(user)
    await hoSoLuongRepo.ghiXemLuong('payroll_sheet', user.id, { ghiChu: `kỳ ${thang}` })
    const [d, chay, duyet, emps] = await Promise.all([
      nap(thang),
      canAction(user, CHAY),
      canAction(user, DUYET),
      chamCongRepo.employees(),
    ])
    const le = d.ky
      ? (await chamCongRepo.holidays(d.ky.tu, congNgay(d.ky.den, 1))).map(
          (h) => h.holiday_date,
        )
      : []
    return {
      thang,
      ky: d.ky,
      bang: d.bang,
      phieu: d.phieu,
      khoan: d.khoan,
      suKien: d.bang ? await bangLuongRepo.suKien(d.bang.id) : [],
      congChuan: d.ky
        ? ((d.ky.banCachTinhId
            ? (await cachTinhRepo.thamSoLuong(d.ky.banCachTinhId)).congChuan
            : null) ?? congChuan(d.ky.tu, d.ky.den, le))
        : null,
      canTinhLai: d.canTinhLai,
      dieuKien: dieuKienGui(d.phieu, d.canTinhLai),
      // Ai có làm trong kỳ (kể cả đã nghỉ giữa kỳ) thì thêm khoản được.
      nhanVien: emps
        .filter((e) =>
          d.ky
            ? !!khoangTrongKy(
                { hireDate: e.hire_date, leaveDate: e.leave_date },
                d.ky.tu,
                d.ky.den,
              )
            : e.active,
        )
        .map((e) => ({ id: e.id, ma: e.code, ten: e.full_name })),
      quyen: { chay, duyet },
    }
  },

  /** Tạo / Tính lại toàn bộ phiếu từ ba nguồn. Chỉ khi bảng còn nháp. */
  async tinh(user: User, thang: string): Promise<KetQuaTinh> {
    await assertAction(user, CHAY)
    return tinhLoi(thang, user.id)
  },

  /**
   * Hệ thống tự tính ngay khi Nhân sự chốt kỳ công (luồng duyệt 21/10/2026, Q2). Bảng đã gửi
   * duyệt trở đi thì bỏ qua (null) — kỳ công không mở lại được khi đó nên hiếm khi xảy ra.
   */
  async tinhTuDong(thang: string): Promise<KetQuaTinh | null> {
    const b = await bangLuongRepo.bang(thang)
    if (b && b.trangThai !== 'draft') return null
    return tinhLoi(thang, null)
  },

  async gui(user: User, thang: string): Promise<void> {
    await assertAction(user, CHAY)
    const d = await nap(thang)
    if (!d.bang || d.bang.trangThai !== 'draft' || !d.bang.lanTinh)
      throw Conflict('Chỉ gửi duyệt được bảng lương nháp đã tính')
    const vuong = dieuKienGui(d.phieu, d.canTinhLai).find((x) => !x.ok)
    if (vuong) throw BadRequest(`Chưa gửi duyệt được — ${vuong.ten}: ${vuong.chiTiet}`)
    const ok = await bangLuongRepo.doi(d.bang.id, 'draft', {
      status: 'submitted',
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
      return_reason: null,
    })
    if (!ok) throw Conflict('Bảng lương vừa đổi trạng thái — tải lại trang')
    await bangLuongRepo.ghiSuKien(d.bang.id, 'submit', user.id, null, {
      thucLinh: d.phieu.reduce((s, p) => s + p.thucLinh, 0),
    })
  },

  async rut(user: User, thang: string): Promise<void> {
    await assertAction(user, CHAY)
    const b = await bangLuongRepo.bang(thang)
    if (!b || b.trangThai !== 'submitted')
      throw Conflict('Bảng lương không ở trạng thái chờ duyệt')
    await bangLuongRepo.doi(b.id, 'submitted', { status: 'draft' })
    await bangLuongRepo.ghiSuKien(b.id, 'withdraw', user.id)
  },

  async quyet(user: User, thang: string, dongY: boolean, lyDo?: string): Promise<void> {
    await assertAction(user, DUYET)
    const b = await bangLuongRepo.bang(thang)
    if (!b || b.trangThai !== 'submitted')
      throw Conflict('Bảng lương không ở trạng thái chờ duyệt')
    if (b.guiBoiId === user.id)
      throw Forbidden(
        'Bạn là người gửi bảng lương này — người khác có quyền duyệt phải xử lý',
      )
    if (!dongY && !lyDo?.trim()) throw BadRequest('Ghi lý do trả lại')
    const ok = await bangLuongRepo.doi(
      b.id,
      'submitted',
      dongY
        ? {
            status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          }
        : { status: 'draft', return_reason: lyDo!.trim() },
    )
    if (!ok) throw Conflict('Bảng lương vừa đổi trạng thái — tải lại trang')
    await bangLuongRepo.ghiSuKien(
      b.id,
      dongY ? 'approve' : 'return',
      user.id,
      lyDo?.trim() || null,
    )
    // Báo người gửi (chị Phụng) kết quả — handler luong.notifications.
    await emit({
      name: 'hr.payroll.decided',
      thang,
      approved: dongY,
      reason: dongY ? null : lyDo!.trim(),
      decided_by: user.id,
      submitted_by: b.guiBoiId,
    })
  },

  /** Đã duyệt mà chưa chi → rút về nháp để sửa (bắt lý do). */
  async moLai(user: User, thang: string, lyDo: string): Promise<void> {
    await assertAction(user, CHAY)
    const b = await bangLuongRepo.bang(thang)
    if (!b || b.trangThai !== 'approved')
      throw Conflict('Chỉ rút về nháp được bảng đã duyệt mà chưa chi')
    await bangLuongRepo.doi(b.id, 'approved', {
      status: 'draft',
      approved_by: null,
      approved_at: null,
    })
    await bangLuongRepo.ghiSuKien(b.id, 'reopen', user.id, lyDo)
  },

  async chi(user: User, thang: string): Promise<void> {
    await assertAction(user, CHAY)
    const b = await bangLuongRepo.bang(thang)
    if (!b || b.trangThai !== 'approved')
      throw Conflict('Chỉ đánh dấu đã chi được bảng đã duyệt')
    await bangLuongRepo.doi(b.id, 'approved', {
      status: 'paid',
      paid_by: user.id,
      paid_at: new Date().toISOString(),
    })
    await bangLuongRepo.ghiSuKien(b.id, 'paid', user.id)
  },

  async themKhoan(
    user: User,
    thang: string,
    ds: { employeeId: string; loai: LoaiKhoan; tien: number; ghiChu: string | null }[],
  ): Promise<number> {
    await assertAction(user, CHAY)
    const b = await bangLuongRepo.bang(thang)
    if (b && b.trangThai !== 'draft')
      throw Conflict('Bảng lương đã gửi duyệt — rút về nháp trước khi thêm khoản')
    await bangLuongRepo.themKhoan(thang, ds, user.id)
    return ds.length
  },

  async xoaKhoan(user: User, thang: string, id: string): Promise<void> {
    await assertAction(user, CHAY)
    const b = await bangLuongRepo.bang(thang)
    if (b && b.trangThai !== 'draft')
      throw Conflict('Bảng lương đã gửi duyệt — rút về nháp trước khi xoá khoản')
    await bangLuongRepo.xoaKhoan(thang, id)
  },

  /** Kỳ công xin mở lại: chặn khi bảng lương đã gửi duyệt trở đi (B5 · máy trạng thái). */
  async kiemMoLaiKyCong(thang: string): Promise<void> {
    const b = await bangLuongRepo.bang(thang)
    if (b && b.trangThai !== 'draft')
      throw Conflict(
        b.trangThai === 'paid'
          ? 'Lương kỳ này đã chi — không mở lại kỳ công; ghi khoản Truy lĩnh / Truy thu ở kỳ sau'
          : 'Bảng lương kỳ này đã gửi duyệt — rút bảng lương về nháp trước khi xin mở lại kỳ công',
      )
  },
}
