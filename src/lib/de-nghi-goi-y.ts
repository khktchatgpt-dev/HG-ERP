import { DE_NGHI_NHAN, type DeNghiStatus } from './de-nghi'
import { isoToVn, todayVn } from './date-vn'

/**
 * THÔNG TIN DƯỚI MỘT DÒNG ĐỀ NGHỊ (Đ6, bản vẽ DN-7 / DN-8
 * https://claude.ai/artifact/Tu7kTTCUPr2aALmAZ2g18b) — chỉ là CÂU CHỮ dùng chung
 * cho màn Kho lập phiếu và màn lãnh đạo duyệt; mỗi màn tự bày theo cách của nó.
 *
 * Số đo 13/10: 7/7 mã có sẵn trên tờ giấy chưa từng có giao dịch sổ kho → "tồn
 * 0" tô vàng làm lãnh đạo đọc thành "kho hết". Chưa theo dõi ≠ hết hàng.
 */

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

export type TonDong = { ton: number | null; theo_doi?: boolean | null }

/** Tồn bày thế nào: null = dòng chưa có mã; "chưa theo dõi" = mã chưa từng có giao dịch. */
export function tonNhan(
  d: TonDong,
): { text: string; het: boolean; chuaTheoDoi: boolean } | null {
  if (d.ton == null) return null
  if (d.theo_doi === false && d.ton <= 0)
    return { text: 'chưa theo dõi trên sổ', het: false, chuaTheoDoi: true }
  return { text: fmt(d.ton), het: d.ton <= 0, chuaTheoDoi: false }
}

export type GiaTruoc = {
  unit_price: number
  po_code: string
  supplier_name: string
  at: string
  nguon?: 'po' | 'kho'
}

/** "lần trước 5.200 · 02/10 · Tiệm Tân Hưng" — null khi chưa từng mua trên hệ thống. */
export function giaTruocCau(g: GiaTruoc | null | undefined): string | null {
  if (!g) return null
  return `lần trước ${fmt(g.unit_price)} · ${isoToVn(g.at.length > 10 ? todayVn(new Date(g.at)) : g.at).slice(0, 5)} · ${g.supplier_name}`
}

/** Chênh giá dự kiến so với lần trước, làm tròn %: +6 = cao hơn 6%. null khi không so được. */
export function chenhGia(
  duKien: number | null,
  g: GiaTruoc | null | undefined,
): number | null {
  if (duKien == null || !g || !(g.unit_price > 0)) return null
  return Math.round(((duKien - g.unit_price) / g.unit_price) * 100)
}

export type Trung = { code: string; status: DeNghiStatus; qty: number }
export type DangVe = { po_code: string; qty_open: number }

/** "đang có trong DNM-2026-0005 (Chờ duyệt, 20)" — nhiều phiếu thì nêu phiếu đầu + số còn lại. */
export function trungCau(ds: readonly Trung[] | undefined, dvt: string): string | null {
  if (!ds || ds.length === 0) return null
  const a = ds[0]
  const them = ds.length > 1 ? ` + ${ds.length - 1} phiếu khác` : ''
  return `đang có trong ${a.code} (${DE_NGHI_NHAN[a.status].toLowerCase()}, ${fmt(a.qty)} ${dvt})${them}`
}

/** "PO-2026-0174 còn về 20 kg" — Cung ứng đang có đơn mua cùng mã chưa về hết. */
export function dangVeCau(ds: readonly DangVe[] | undefined, dvt: string): string | null {
  if (!ds || ds.length === 0) return null
  const tong = ds.reduce((s, x) => s + x.qty_open, 0)
  return ds.length === 1
    ? `${ds[0].po_code} còn về ${fmt(tong)} ${dvt}`
    : `${ds.length} đơn mua còn về ${fmt(tong)} ${dvt} (${ds[0].po_code}…)`
}
