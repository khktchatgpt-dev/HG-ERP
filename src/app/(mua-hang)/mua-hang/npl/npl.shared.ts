import type { NplRow, NplTab } from '@/lib/npl-theo-lenh'

/**
 * Tab trên URL (`?tab=`): "con" (Còn phải đặt — từ định mức, bản vẽ 3) + bốn rổ
 * theo đơn + "tat_ca" (mọi dòng đơn).
 */
export type NplTabXem = 'con' | NplTab | 'tat_ca'

/** Số trên tab là chữ thường, không ô nền đặc (bản 2): nền đặc chỉ cho thứ bấm được. */
export const TAB_XEM: { key: NplTabXem; label: string }[] = [
  { key: 'con', label: 'Còn phải đặt' },
  // Bản 2 gọi "Chưa đặt" — sai nghĩa: tab chỉ chứa dòng ĐÃ nằm trên đơn nháp.
  { key: 'chua_dat', label: 'Đơn nháp / chờ duyệt' },
  { key: 'cho_ncc', label: 'Chờ NCC xác nhận' },
  { key: 'thieu', label: 'Đang về còn thiếu' },
  { key: 'du', label: 'Về đủ' },
  { key: 'tat_ca', label: 'Tất cả' },
]

/** Q1 bản vẽ 3: mở màn vào "Còn phải đặt". */
export const TAB_DAU: NplTabXem = 'con'

export function tabHopLe(v: string | undefined): NplTabXem {
  return TAB_XEM.some((t) => t.key === v) ? (v as NplTabXem) : TAB_DAU
}

export function trongTab(r: NplRow, tab: NplTabXem): boolean {
  return tab === 'tat_ca' || r.tab === tab
}

/** Lọc Tình trạng ở tab Còn phải đặt. */
export const TT_CON: { key: 'chua_co_don' | 'dat_thieu' | 'gan_ten'; label: string }[] = [
  { key: 'chua_co_don', label: 'Chưa có đơn' },
  { key: 'dat_thieu', label: 'Đặt thiếu' },
  { key: 'gan_ten', label: 'Có thể đặt mã khác' },
]

/** Tab có dòng trễ — chỉ ở đây mới bày ô "Chỉ dòng trễ" và cột Hẹn rộng. */
export const coTre = (tab: NplTabXem) => tab === 'thieu' || tab === 'tat_ca'

export type CotKey =
  | 'gut'
  | 'ma'
  | 'ten'
  | 'dvt'
  | 'sl'
  | 'dat'
  | 've'
  | 'thieu'
  | 'don'
  | 'ncc'
  | 'nguoi'
  | 'hen'
  | 'tt'

export type Cot = { key: CotKey; label: string; w?: number; r?: boolean }

/**
 * CỘT THEO TAB (bản vẽ 2 · Q3, đo ở lưới 980px). Mỗi tab chỉ bày cột có tin:
 * Chưa đặt / Chờ NCC chỉ một cột SL (Đã về luôn "—", Còn thiếu luôn = Đặt);
 * Đang về bỏ Tình trạng (chờ giao hay về một phần đọc ở cột Đã về); Về đủ bỏ
 * Tình trạng (luôn "Về đủ"). Phụ trách chỉ ở Cả phòng. Tên NPL là cột giãn —
 * ~310px ở Chưa đặt · của tôi, ~240px ở Đang về · cả phòng khi lưới 980px
 * (bản 1: 146px cho cả mã lẫn tên, cắt 111/124 dòng).
 */
export function cotTheoTab(tab: NplTabXem, phong: boolean): Cot[] {
  const chuaVe = tab === 'chua_dat' || tab === 'cho_ncc'
  const so: Cot[] = chuaVe
    ? [{ key: 'sl', label: 'SL', w: 72, r: true }]
    : [
        { key: 'dat', label: 'Đặt', w: 60, r: true },
        { key: 've', label: 'Đã về', w: 60, r: true },
        ...(tab === 'thieu'
          ? [{ key: 'thieu' as const, label: 'Còn thiếu', w: 64, r: true }]
          : []),
      ]
  return [
    { key: 'gut', label: '', w: 18 },
    { key: 'ma', label: 'Mã', w: 84 },
    { key: 'ten', label: 'Tên NPL' },
    // 52: "Thùng", "Thanh" — 48 cắt mất chữ cuối (đo 21/11/2026).
    { key: 'dvt', label: 'ĐVT', w: 52 },
    ...so,
    { key: 'don', label: 'Đơn mua', w: 108 },
    { key: 'ncc', label: 'NCC', w: chuaVe ? 180 : 140 },
    // 70: tiêu đề "Phụ trách" cắt chữ ở 60px (đo 21/11/2026).
    ...(phong ? [{ key: 'nguoi' as const, label: 'Phụ trách', w: 70 }] : []),
    { key: 'hen', label: 'Hẹn về', w: coTre(tab) ? 100 : 60 },
    ...(tab === 'thieu' || tab === 'du'
      ? []
      : [{ key: 'tt' as const, label: 'Tình trạng', w: 92 }]),
  ]
}

const SO = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 })
export const soVn = (n: number) => SO.format(n)

/** "2026-11-05" → "05/11" (cùng năm với hôm nay) hoặc "05/11/27". */
export function ngayNgan(iso: string, today: string): string {
  const dm = `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  return iso.slice(0, 4) === today.slice(0, 4) ? dm : `${dm}/${iso.slice(2, 4)}`
}

/** "2026-11-29" → "29/11/2026". */
export function ngayDu(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}
