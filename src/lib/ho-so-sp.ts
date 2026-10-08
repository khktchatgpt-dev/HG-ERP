/**
 * CHECKLIST HỒ SƠ SẢN PHẨM — 6 ô: BOM · BV · Ảnh · ĐG · XC · Mẫu (08/10/2026).
 *
 * Chép từ app CodeIgniter cũ (thanh 7 ô dưới ảnh mỗi thẻ SP + lọc "Thiếu…"),
 * bỏ hai ô AI / Tem nhãn vì HG-ERP chưa có loại file đó.
 *
 * Thuần, không chạm DB, nằm ở `lib/` vì CẢ server (đếm chip) lẫn client (vẽ ô)
 * đều gọi — nguyên tắc 3 của erp-ui: số trên chip và ô trên dòng phải ra từ
 * ĐÚNG MỘT hàm, không thì hôm nay bằng nhau mà mai lệch.
 */

export const HO_SO_O = ['bom', 'bv', 'anh', 'dg', 'xc', 'mau'] as const
export type HoSoO = (typeof HO_SO_O)[number]

export const HO_SO_LABEL: Record<HoSoO, string> = {
  bom: 'BOM',
  bv: 'BV',
  anh: 'Ảnh',
  dg: 'ĐG',
  xc: 'XC',
  mau: 'Mẫu',
}

/** Chữ đầy đủ cho tooltip / ô chọn lọc. */
export const HO_SO_TEN: Record<HoSoO, string> = {
  bom: 'Định mức (dòng BOM)',
  bv: 'Bản vẽ',
  anh: 'Ảnh đại diện',
  dg: 'Phương án đóng gói',
  xc: 'Số xếp cont 40HC',
  mau: 'Hiện vật mẫu',
}

/**
 * `co` có · `thieu` thiếu (tô đỏ, đếm vào chip "Thiếu") · `khong_ap_dung` SP
 * không cần thứ đó (xám, KHÔNG đếm) — nệm bán rời không cần BOM, SP chưa làm
 * mẫu thì ô Mẫu không phải lỗi.
 */
export type HoSoState = 'co' | 'thieu' | 'khong_ap_dung'
export type HoSoCheck = Record<HoSoO, HoSoState>

export type HoSoInput = {
  /** Có ≥1 dòng định mức (`technical_product_parts`). */
  has_parts: boolean
  /** Có file `doc_type = 'drawing'`. */
  has_drawing: boolean
  has_image: boolean
  /** Có phương án đóng gói (bảng `technical_packing_options`) HOẶC jsonb `packing` có kích thước thùng. */
  has_packing: boolean
  /** Có số xếp cont 40HC (phương án mặc định, hoặc jsonb). */
  has_loading: boolean
  /** Có hiện vật mẫu chưa thanh lý (`technical_samples.status != disposed`). */
  has_sample: boolean
  /**
   * SP có cần định mức không. Mặc định có; `false` cho phụ kiện bán rời (loại
   * `AC`) — chốt tạm theo loại SP cho tới khi có cờ riêng (Q4 của bản vẽ 08/10).
   */
  bom_required: boolean
}

export function hoSoCheck(i: HoSoInput): HoSoCheck {
  return {
    bom: i.has_parts ? 'co' : i.bom_required ? 'thieu' : 'khong_ap_dung',
    bv: i.has_drawing ? 'co' : 'thieu',
    anh: i.has_image ? 'co' : 'thieu',
    dg: i.has_packing ? 'co' : 'thieu',
    // Chưa có phương án đóng gói thì "xếp cont" chưa có chỗ để khai: tính là
    // thiếu MỘT thứ (ĐG), không phải hai.
    xc: i.has_loading ? 'co' : i.has_packing ? 'thieu' : 'khong_ap_dung',
    mau: i.has_sample ? 'co' : 'khong_ap_dung',
  }
}

/** Các ô đang THIẾU — chip "Thiếu bất kỳ" = mảng này khác rỗng. */
export function hoSoThieu(c: HoSoCheck): HoSoO[] {
  return HO_SO_O.filter((o) => c[o] === 'thieu')
}

/** Số ô đã có / số ô áp dụng — "4 / 6" trên dải hiệu suất của hồ sơ. */
export function hoSoDiem(c: HoSoCheck): { co: number; apDung: number } {
  let co = 0
  let apDung = 0
  for (const o of HO_SO_O) {
    if (c[o] === 'khong_ap_dung') continue
    apDung++
    if (c[o] === 'co') co++
  }
  return { co, apDung }
}

/** Loại SP không cần định mức — tạm theo mã loại (Q4). */
export const LOAI_KHONG_CAN_BOM: ReadonlySet<string> = new Set(['AC'])

export function bomRequiredFor(productType: string | null | undefined): boolean {
  return !(productType && LOAI_KHONG_CAN_BOM.has(productType))
}

/** Giá trị ô lọc "Thiếu hồ sơ" trên URL (`thieu=`). */
export const THIEU_FILTER = ['any', ...HO_SO_O] as const
export type ThieuFilter = (typeof THIEU_FILTER)[number]

export function isThieuFilter(v: string): v is ThieuFilter {
  return (THIEU_FILTER as readonly string[]).includes(v)
}

/** Dòng khớp ô lọc "Thiếu hồ sơ" không. */
export function matchThieu(c: HoSoCheck, f: ThieuFilter): boolean {
  if (f === 'any') return hoSoThieu(c).length > 0
  return c[f] === 'thieu'
}
