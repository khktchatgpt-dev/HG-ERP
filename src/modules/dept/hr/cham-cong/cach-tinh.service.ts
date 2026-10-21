import type { User } from '@/modules/core/users/users.repo'
import { assertAction, canAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'
import {
  banChoKy,
  duoiLuat,
  kiemKhung,
  kiemQuyTac,
  LOAI_NGAY,
  mucLuat,
  NGHI_LUONG,
  thamSoTuBan,
  tinhTrangBan,
  type KhungBan,
  type LoiKhung,
  type QuyTac,
  type TinhTrangBan,
} from '@/lib/cham-cong/cach-tinh'
import { THAM_SO_MAC_DINH, type ThamSoKhung } from '@/lib/cham-cong/gio-khung'
import { khoangKyService } from './khoang-ky.service'
import { todayVn } from '@/lib/date-vn'
import { cachTinhRepo, type BanDong, type HeSoDong } from './cach-tinh.repo'

/**
 * CÁCH TÍNH CÔNG (B2, bản vẽ duyệt 18/10/2026 — Q1–Q6 theo đề xuất).
 *
 * Danh mục có phiên bản theo kỳ, KHÔNG phải chứng từ: nháp → áp dụng từ kỳ X. Bản đã áp
 * dụng chỉ xem; muốn đổi thì chép thành bản mới. Bản bắt đầu từ kỳ hiện tại trở đi rút về
 * nháp được (chưa kỳ nào dùng xong nó).
 *
 * Quyền (câu Q4): Kế toán sửa hệ số lương (`hr.calc.rates_edit`), Nhân sự sửa khung + quy
 * tắc (`hr.calc.rules_edit`). Hệ số dưới mức luật: cảnh báo + bắt lý do khi áp dụng (Q3).
 */

export type QuyenCachTinh = { heSo: boolean; quyTac: boolean; to: boolean }

export type BanXem = BanDong & { tinhTrang: TinhTrangBan }

export type CachTinhTrang = {
  kyHienTai: string
  /** Khoảng kỳ hiện tại (Nhân sự đặt / gợi ý). */
  khoangHienTai: { tu: string; den: string }
  ban: BanXem[]
  /** Bản đang mở trên màn. */
  xem: BanXem
  khung: KhungBan[]
  heSo: HeSoDong[]
  loiKhung: LoiKhung[]
  loiQuyTac: string | null
  /** Ô hệ số dưới mức luật mà chưa ghi lý do — chặn Áp dụng. */
  duoiLuatChuaLyDo: number
  /** Ô hệ số còn trống (không chặn — tính 0 đồng ở bảng lương). */
  oTrong: number
  to: Awaited<ReturnType<typeof cachTinhRepo.to>>
  chuaCoTo: number
  quyen: QuyenCachTinh
}

async function quyen(user: User): Promise<QuyenCachTinh> {
  const [heSo, quyTac, to] = await Promise.all([
    canAction(user, 'hr.calc.rates_edit'),
    canAction(user, 'hr.calc.rules_edit'),
    canAction(user, 'hr.attendance.employee_edit'),
  ])
  return { heSo, quyTac, to }
}

/** Mức tối thiểu theo luật của một ô hệ số (null = luật không buộc). */
function mucToiThieu(h: HeSoDong, khung: KhungBan[]): number | null {
  if (h.loai === 'leave') return NGHI_LUONG.find((n) => n.ma === h.ma)?.toiThieu ?? null
  const k = khung.find((x) => x.ma === h.ma)
  return k && h.ngay !== 'any' ? mucLuat(k, h.ngay).min : null
}

/** Đủ mọi ô: khung × 3 loại ngày + 6 loại nghỉ (bản cũ thiếu ô thì thêm ô trống). */
function duO(khung: KhungBan[], heSo: HeSoDong[]): HeSoDong[] {
  const co = new Map(heSo.map((h) => [`${h.loai}|${h.ma}|${h.ngay}`, h]))
  const out: HeSoDong[] = []
  for (const k of khung)
    for (const n of LOAI_NGAY)
      out.push(
        co.get(`frame|${k.ma}|${n}`) ?? {
          loai: 'frame',
          ma: k.ma,
          ngay: n,
          pt: null,
          lyDo: null,
        },
      )
  for (const n of NGHI_LUONG)
    out.push(
      co.get(`leave|${n.ma}|any`) ?? {
        loai: 'leave',
        ma: n.ma,
        ngay: 'any',
        pt: n.coDinh ?? null,
        lyDo: null,
      },
    )
  return out
}

async function lay(banId: string) {
  const ds = await cachTinhRepo.dsBan()
  const b = ds.find((x) => x.id === banId)
  if (!b) throw NotFound('Không có bản cách tính này — tải lại trang')
  return { ds, b }
}

export const cachTinhService = {
  async trang(user: User, banId?: string): Promise<CachTinhTrang> {
    await assertAction(user, 'hr.attendance.view')
    const kyHienTai = await khoangKyService.thangCua(todayVn())
    const [ds, to, chuaCoTo, q] = await Promise.all([
      cachTinhRepo.dsBan(),
      cachTinhRepo.to(),
      cachTinhRepo.soNguoiChuaCoTo(),
      quyen(user),
    ])
    if (!ds.length) throw NotFound('Chưa có bản cách tính nào — áp migration 0243')
    const ban = ds.map((b) => ({ ...b, tinhTrang: tinhTrangBan(b, ds, kyHienTai) }))
    const xem =
      ban.find((b) => b.id === banId) ??
      ban.find((b) => b.id === banChoKy(ds, kyHienTai)?.id) ??
      ban[ban.length - 1]
    const [khung, heSoGoc] = await Promise.all([
      cachTinhRepo.khung(xem.id),
      cachTinhRepo.heSo(xem.id),
    ])
    const heSo = duO(khung, heSoGoc)
    return {
      kyHienTai,
      khoangHienTai: await khoangKyService.cua(kyHienTai),
      ban,
      xem,
      khung,
      heSo,
      loiKhung: kiemKhung(khung),
      loiQuyTac: kiemQuyTac(xem.quyTac, khung),
      duoiLuatChuaLyDo: heSo.filter(
        (h) => duoiLuat(h.pt, mucToiThieu(h, khung)) && !h.lyDo?.trim(),
      ).length,
      oTrong: heSo.filter((h) => h.pt == null).length,
      to,
      chuaCoTo,
      quyen: q,
    }
  },

  /** Chép một bản thành bản nháp mới. */
  async taoBan(user: User, tuBanId: string): Promise<{ id: string; so: number }> {
    const q = await quyen(user)
    if (!q.heSo && !q.quyTac)
      throw Forbidden('Kế toán hoặc Nhân sự mới tạo được bản cách tính mới')
    const { b } = await lay(tuBanId)
    const [khung, heSo] = await Promise.all([
      cachTinhRepo.khung(b.id),
      cachTinhRepo.heSo(b.id),
    ])
    return cachTinhRepo.taoTu(b, khung, duO(khung, heSo), user.id)
  },

  async luu(
    user: User,
    banId: string,
    v: { quyTac?: QuyTac; khung?: KhungBan[]; heSo?: HeSoDong[] },
  ): Promise<void> {
    const q = await quyen(user)
    const { b } = await lay(banId)
    if (b.tuKy)
      throw Conflict(`Bản ${b.so} đã áp dụng từ kỳ ${b.tuKy} — chép thành bản mới để sửa`)
    if ((v.quyTac || v.khung) && !q.quyTac)
      throw Forbidden('Khung giờ và quy tắc do Nhân sự sửa')
    if (v.heSo && !q.heSo) throw Forbidden('Hệ số lương do Tài Chính Kế Toán sửa')
    if (v.khung) {
      const ma = new Set(v.khung.map((k) => k.ma))
      if (ma.size !== v.khung.length) throw BadRequest('Mã khung bị trùng')
      await cachTinhRepo.ghiKhung(banId, v.khung)
    }
    if (v.quyTac) await cachTinhRepo.suaQuyTac(banId, v.quyTac, user.id)
    if (v.heSo) {
      const kl = NGHI_LUONG.find((n) => n.coDinh != null)
      const heSo = v.heSo.map((h) =>
        h.loai === 'leave' && h.ma === kl?.ma ? { ...h, pt: kl.coDinh ?? 0 } : h,
      )
      await cachTinhRepo.ghiHeSo(banId, heSo, user.id)
    }
    if (!v.quyTac) await cachTinhRepo.danhDau(banId, user.id)
  },

  async apDung(user: User, banId: string, tuKy: string): Promise<void> {
    const q = await quyen(user)
    if (!q.heSo && !q.quyTac)
      throw Forbidden('Kế toán hoặc Nhân sự mới áp dụng được bản cách tính')
    const { ds, b } = await lay(banId)
    if (b.tuKy) throw Conflict(`Bản ${b.so} đã áp dụng từ kỳ ${b.tuKy}`)
    const kyHienTai = await khoangKyService.thangCua(todayVn())
    if (tuKy < kyHienTai)
      throw BadRequest(
        `Chỉ áp dụng từ kỳ đang mở (${kyHienTai}) trở đi — kỳ trước đã tính xong`,
      )
    const trung = ds.find((x) => x.tuKy === tuKy)
    if (trung)
      throw Conflict(
        `Kỳ ${tuKy} đã có Bản ${trung.so} bắt đầu — chọn kỳ khác hoặc rút Bản ${trung.so} về nháp`,
      )
    const [khung, heSoGoc] = await Promise.all([
      cachTinhRepo.khung(banId),
      cachTinhRepo.heSo(banId),
    ])
    const loi = kiemKhung(khung)
    if (loi.length) throw BadRequest(`Khung giờ chưa hợp lệ: ${loi[0].ma} ${loi[0].loi}`)
    const lq = kiemQuyTac(b.quyTac, khung)
    if (lq) throw BadRequest(lq)
    const thieuLyDo = duO(khung, heSoGoc).filter(
      (h) => duoiLuat(h.pt, mucToiThieu(h, khung)) && !h.lyDo?.trim(),
    )
    if (thieuLyDo.length)
      throw BadRequest(
        `${thieuLyDo.length} ô hệ số thấp hơn mức luật chưa ghi lý do (đầu tiên: ${thieuLyDo[0].ma})`,
      )
    await cachTinhRepo.apDung(banId, tuKy, user.id)
  },

  async rutVeNhap(user: User, banId: string): Promise<void> {
    const q = await quyen(user)
    if (!q.heSo && !q.quyTac) throw Forbidden('Kế toán hoặc Nhân sự mới rút được bản')
    const { b } = await lay(banId)
    if (!b.tuKy) throw Conflict(`Bản ${b.so} đang là nháp`)
    const kyHienTai = await khoangKyService.thangCua(todayVn())
    if (b.tuKy < kyHienTai)
      throw Conflict(
        `Bản ${b.so} đã dùng cho kỳ ${b.tuKy} — không rút được; chép thành bản mới rồi áp dụng từ kỳ sau`,
      )
    await cachTinhRepo.rutVeNhap(banId, user.id)
  },

  async xoaNhap(user: User, banId: string): Promise<void> {
    const q = await quyen(user)
    if (!q.heSo && !q.quyTac)
      throw Forbidden('Kế toán hoặc Nhân sự mới huỷ được bản nháp')
    const { b } = await lay(banId)
    if (b.tuKy) throw Conflict(`Bản ${b.so} đã áp dụng — rút về nháp trước khi huỷ`)
    await cachTinhRepo.xoaNhap(banId)
  },

  /** Tham số giờ khung cho kỳ — Bảng giờ công dùng. Chưa có bản nào thì dùng số mặc định. */
  async thamSoChoKy(
    thang: string,
  ): Promise<{ thamSo: ThamSoKhung; ban: number | null; banId: string | null }> {
    const ds = await cachTinhRepo.dsBan()
    const b = banChoKy(ds, thang)
    if (!b) return { thamSo: THAM_SO_MAC_DINH, ban: null, banId: null }
    const khung = await cachTinhRepo.khung(b.id)
    return { thamSo: thamSoTuBan(khung, b.quyTac), ban: b.so, banId: b.id }
  },
}
