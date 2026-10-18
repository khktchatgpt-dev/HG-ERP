/**
 * CÁCH TÍNH CÔNG CÓ PHIÊN BẢN — hàm thuần (B2, bản vẽ duyệt 18/10/2026).
 *
 * Một BẢN = 6 khung giờ + quy tắc đơn + hệ số lương. Kỳ X dùng bản đã áp dụng có "từ kỳ"
 * lớn nhất ≤ X — đổi bản không làm đổi số của kỳ trước nó. Bảng 0243.
 *
 * Hệ số lương chưa nhân vào giờ ở đây (việc của bảng lương, B5); file này chỉ cho mức
 * tối thiểu theo luật để màn cảnh báo (Điều 98 BLLĐ 2019; NĐ 145/2020 cho làm đêm).
 */

import type { Khung, KieuLamTronRa, ThamSoKhung } from './gio-khung'

export type LoaiNgay = 'thuong' | 'cn' | 'le'
export const LOAI_NGAY: LoaiNgay[] = ['thuong', 'cn', 'le']
export const TEN_LOAI_NGAY: Record<LoaiNgay, string> = {
  thuong: 'Ngày thường',
  cn: 'Chủ nhật',
  le: 'Lễ, Tết',
}

/** Loại nghỉ có hệ số: 5 loại của phiếu điều chỉnh + nghỉ lễ không đi làm. */
export type MaNghiLuong =
  'annual' | 'holiday' | 'personal' | 'business_trip' | 'sick' | 'unpaid'
export const NGHI_LUONG: {
  ma: MaNghiLuong
  ky: string
  ten: string
  tinhCong: string
  aiTra: string
  ghiChu: string
  /** % tối thiểu luật buộc (null = luật không buộc công ty trả). */
  toiThieu: number | null
  /** Không cho sửa (KL luôn 0). */
  coDinh?: number
}[] = [
  {
    ma: 'annual',
    ky: 'P',
    ten: 'Phép năm',
    tinhCong: 'Có',
    aiTra: 'Công ty',
    ghiChu: 'Điều 113 BLLĐ',
    toiThieu: 100,
  },
  {
    ma: 'holiday',
    ky: 'L',
    ten: 'Nghỉ lễ, Tết (không đi làm)',
    tinhCong: 'Có',
    aiTra: 'Công ty',
    ghiChu: 'lấy từ lịch ngày lễ',
    toiThieu: 100,
  },
  {
    ma: 'personal',
    ky: 'R',
    ten: 'Việc riêng có lương (cưới, tang)',
    tinhCong: 'Có',
    aiTra: 'Công ty',
    ghiChu: 'Điều 115 BLLĐ',
    toiThieu: 100,
  },
  {
    ma: 'business_trip',
    ky: 'CT',
    ten: 'Công tác',
    tinhCong: 'Có, 1 công/ngày',
    aiTra: 'Công ty',
    ghiChu: '',
    toiThieu: 100,
  },
  {
    ma: 'sick',
    ky: 'Ô',
    ten: 'Ốm, thai sản',
    tinhCong: 'Không',
    aiTra: 'BHXH',
    ghiChu: 'BHXH chi trợ cấp, không vào bảng lương',
    toiThieu: null,
  },
  {
    ma: 'unpaid',
    ky: 'KL',
    ten: 'Không lương',
    tinhCong: 'Không',
    aiTra: '—',
    ghiChu: 'cố định 0, không sửa',
    toiThieu: null,
    coDinh: 0,
  },
]

export type KhungBan = {
  ma: string
  ten: string
  /** Phút từ 0h ngày bắt đầu ca (qua 0h > 1440). */
  tu: number
  den: number
  boPhanLo: boolean
  hanhChinh: boolean
}

export type QuyTac = {
  truaTu: number
  truaDen: number
  anHanPhut: number
  lamTronRaKieu: KieuLamTronRa
  nguongNuaGio: number
  nguongDuGio: number
  lamTronVaoChieu: boolean
  tinhDenSom: boolean
  denSomTu: number
  caDemDen: number
  phutMotCong: number
  heSoTrua: number
  phutTruaMacDinh: number
}

export type TinhTrangBan = 'nhap' | 'ap_dung' | 'da_dung'

export type BanTomTat = {
  id: string
  so: number
  /** 'YYYY-MM' — null khi còn nháp. */
  tuKy: string | null
}

/** Kỳ 'YYYY-MM' dùng bản nào: bản đã áp dụng có tuKy lớn nhất ≤ kỳ. Không có → null. */
export function banChoKy<T extends BanTomTat>(ban: T[], thang: string): T | null {
  let chon: T | null = null
  for (const b of ban)
    if (b.tuKy && b.tuKy <= thang && (!chon || b.tuKy > chon.tuKy!)) chon = b
  return chon
}

/**
 * Nhãn trạng thái của từng bản khi đứng ở kỳ `thangHienTai`: nháp · đang áp dụng (bản
 * kỳ hiện tại dùng, hoặc bản tương lai) · đã dùng (đã bị bản mới hơn thay, trước kỳ này).
 */
export function tinhTrangBan(
  b: BanTomTat,
  tatCa: BanTomTat[],
  thangHienTai: string,
): TinhTrangBan {
  if (!b.tuKy) return 'nhap'
  const dangDung = banChoKy(tatCa, thangHienTai)
  if (b.tuKy > thangHienTai || dangDung?.id === b.id) return 'ap_dung'
  return 'da_dung'
}

/** Bản → tham số cho `gio-khung.ts`. */
export function thamSoTuBan(khung: KhungBan[], q: QuyTac): ThamSoKhung {
  const k = [...khung].sort((a, b) => a.tu - b.tu)
  const hc = k.find((x) => x.hanhChinh) ?? k[0]
  return {
    khung: k.map((x): Khung => ({
      ma: x.ma,
      ten: x.ten,
      tu: x.tu,
      den: x.den,
      boPhanLo: x.boPhanLo,
    })),
    khungHanhChinh: hc.ma,
    truaTu: q.truaTu,
    truaDen: q.truaDen,
    anHanPhut: q.anHanPhut,
    nguongNuaGio: q.nguongNuaGio,
    nguongDuGio: q.nguongDuGio,
    lamTronRaKieu: q.lamTronRaKieu,
    lamTronVaoChieu: q.lamTronVaoChieu,
    tinhDenSom: q.tinhDenSom,
    denSomTu: q.denSomTu,
    caDemDen: q.caDemDen,
    phutMotCong: q.phutMotCong,
    heSoTrua: q.heSoTrua,
    phutTruaMacDinh: q.phutTruaMacDinh,
  }
}

/** Phút → 'HH:mm', qua 0h kèm ' (+1)'. */
export function gioKhung(phut: number, laDau = false): string {
  const ngay = Math.floor(phut / 1440)
  const m = phut - ngay * 1440
  const s = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  // Mốc nửa đêm: là ĐẦU khung thì thuộc hôm sau (00:00 (+1)), là CUỐI khung thì 24:00.
  if (ngay > 0 && m === 0 && !laDau) return ngay === 1 ? '24:00' : `24:00 (+${ngay - 1})`
  return ngay > 0 ? `${s} (+${ngay})` : s
}

export type LoiKhung = { ma: string; loi: string }

/**
 * Sáu khung phải nối liền từ giờ vào ca hành chính tới đúng 24 giờ sau: không hở, không
 * chồng, đúng một khung hành chính. Lỗi gắn vào khung để màn nhảy tới đúng dòng.
 */
export function kiemKhung(khung: KhungBan[]): LoiKhung[] {
  const loi: LoiKhung[] = []
  if (!khung.length) return [{ ma: '', loi: 'Chưa có khung giờ nào' }]
  const hc = khung.filter((k) => k.hanhChinh)
  if (hc.length !== 1)
    loi.push({ ma: khung[0].ma, loi: 'Phải có đúng một khung hành chính' })
  for (const k of khung)
    if (k.den <= k.tu)
      loi.push({
        ma: k.ma,
        loi: `"Đến" phải sau "Từ" (${gioKhung(k.tu)} → ${gioKhung(k.den)})`,
      })
  const k = [...khung].sort((a, b) => a.tu - b.tu)
  for (let i = 1; i < k.length; i++) {
    const truoc = k[i - 1]
    const nay = k[i]
    if (nay.tu < truoc.den)
      loi.push({
        ma: nay.ma,
        loi: `Chồng ${truoc.ma} ${gioKhung(nay.tu)}–${gioKhung(truoc.den)} · sửa "Từ" thành ${gioKhung(truoc.den)}`,
      })
    else if (nay.tu > truoc.den)
      loi.push({
        ma: nay.ma,
        loi: `Hở ${gioKhung(truoc.den)}–${gioKhung(nay.tu)} sau ${truoc.ma} · sửa "Từ" thành ${gioKhung(truoc.den)}`,
      })
  }
  const dau = k[0].tu
  const cuoi = k[k.length - 1].den
  if (cuoi - dau !== 1440)
    loi.push({
      ma: k[k.length - 1].ma,
      loi: `Sáu khung phải phủ đúng 24 giờ từ ${gioKhung(dau)} (đang tới ${gioKhung(cuoi)})`,
    })
  if (hc[0] && hc[0].tu !== dau)
    loi.push({ ma: hc[0].ma, loi: 'Khung hành chính phải là khung bắt đầu sớm nhất' })
  return loi
}

/** Quy tắc đơn hợp lệ? Trả câu lỗi đầu tiên (null = ổn). */
export function kiemQuyTac(q: QuyTac, khung: KhungBan[]): string | null {
  const hc = khung.find((k) => k.hanhChinh)
  if (q.truaDen <= q.truaTu) return 'Giờ nghỉ trưa: "đến" phải sau "từ"'
  if (hc && (q.truaTu < hc.tu || q.truaDen > hc.den))
    return 'Giờ nghỉ trưa phải nằm trong khung hành chính'
  if (q.nguongNuaGio > q.nguongDuGio)
    return 'Bậc thang: mốc nửa giờ không được lớn hơn mốc đủ giờ'
  return null
}

/** Phần khung (phút) rơi vào giờ đêm 22:00–06:00. */
function phutDem(k: { tu: number; den: number }): number {
  let dem = 0
  for (const [a, b] of [
    [-120, 360],
    [1320, 1800],
    [2760, 3240],
  ])
    dem += Math.max(0, Math.min(k.den, b) - Math.max(k.tu, a))
  return dem
}

export type MucLuat = { min: number; max: number; ghiChu: string }

/**
 * Mức % tối thiểu theo luật cho giờ làm ở khung `k`, loại ngày `n`.
 * Ngày thường: hành chính 100, làm thêm 150. Ngày nghỉ tuần 200, lễ 300 (Điều 98.1).
 * Giờ đêm: + 30 % (98.2) + 20 % × mức ngày (98.3) → 200 · 270 · 390 khi là làm thêm.
 * Khung một phần ban đêm: min = mức ngày, max = mức đêm (cảnh báo dùng min).
 */
export function mucLuat(
  k: { tu: number; den: number; hanhChinh: boolean },
  n: LoaiNgay,
): MucLuat {
  const ngay = n === 'thuong' ? (k.hanhChinh ? 100 : 150) : n === 'cn' ? 200 : 300
  const dem = phutDem(k)
  const demMuc = n === 'thuong' ? (k.hanhChinh ? 130 : 200) : n === 'cn' ? 270 : 390
  if (dem === 0) return { min: ngay, max: ngay, ghiChu: '' }
  if (dem >= k.den - k.tu) return { min: demMuc, max: demMuc, ghiChu: 'ban đêm' }
  return { min: ngay, max: demMuc, ghiChu: 'một phần ban đêm' }
}

/** Ô hệ số thấp hơn mức luật (ô trống không tính là thấp). */
export const duoiLuat = (pt: number | null, muc: number | null) =>
  pt != null && muc != null && pt < muc
