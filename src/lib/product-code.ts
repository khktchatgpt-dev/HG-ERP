/**
 * Quy tắc mã sản phẩm — đã chốt 25/07/2026
 * (`docs/product-profile-redesign-plan.md` §4 và §7).
 *
 *     CH0201HG-IN
 *     ││└─┬┘ │ └── vật liệu khung (2 ký tự)
 *     ││  │  └──── "HG" cố định
 *     ││  └─────── số thứ tự 4 chữ số, ĐẾM RIÊNG theo từng loại
 *     └┴────────── loại sản phẩm (2 ký tự)
 *
 * Rút từ 6 xuống 4 chữ số ngày 27/07/2026: serial lớn nhất thực tế mới là 197
 * (loại CH) nên 6 chữ số chỉ tạo ra ba số 0 vô nghĩa ở MỌI mã. 4 chữ số trùng
 * đúng dạng mã cũ `S0049HG-AL` mà xưởng đang quen đọc, vẫn dư tới 9.999 SP/loại.
 * 445 mã cũ đã được đánh lại cùng ngày (giữ nguyên serial, chỉ bớt số 0).
 *
 * `CODE_RE` vẫn nhận 4–6 chữ số: mã 6 số còn nằm trên chứng từ đã in và trong
 * các file Excel cũ, dán lại vào ô tìm kiếm phải parse được chứ không thành
 * "mã lạ". Chỉ `buildProductCode` là luôn sinh ra 4 chữ số.
 *
 * Kiểm trên dữ liệu thật (451 SP, 26/07/2026): 445 mã đúng quy tắc, 6 mã cũ
 * nhập tay từ trước (`RHONE-CHAIR`, `28256-228`…) — parse trả null, không phá
 * việc đánh số vì `nextSerial` chỉ đếm mã đúng dạng.
 *
 * File thuần, KHÔNG chạm DB — dùng được ở cả client (form tạo SP) lẫn server.
 */

export const PRODUCT_TYPES = [
  { code: 'TB', label: 'Bàn' },
  { code: 'CH', label: 'Ghế' },
  { code: 'BN', label: 'Băng ghế / sofa bank' },
  { code: 'ST', label: 'Bộ sản phẩm' },
  { code: 'SL', label: 'Giường tắm nắng' },
  { code: 'OT', label: 'Ngoài trời khác (lều, tủ, giường)' },
  { code: 'AC', label: 'Phụ kiện' },
] as const

/** Vật liệu KHUNG — khác với cột `material` (chất liệu mô tả cho catalogue). */
export const FRAME_MATERIALS = [
  { code: 'AL', label: 'Nhôm' },
  { code: 'IR', label: 'Sắt' },
  { code: 'IN', label: 'Inox' },
  { code: 'WD', label: 'Gỗ' },
  { code: 'RA', label: 'Mây / nhựa đan' },
  { code: 'GL', label: 'Kính' },
  { code: 'MX', label: 'Hỗn hợp' },
  { code: 'XX', label: 'Chưa xác định' },
] as const

export const PRODUCT_TYPE_CODES = PRODUCT_TYPES.map((t) => t.code)
export const FRAME_MATERIAL_CODES = FRAME_MATERIALS.map((m) => m.code)

export type ProductTypeCode = (typeof PRODUCT_TYPES)[number]['code']
export type FrameMaterialCode = (typeof FRAME_MATERIALS)[number]['code']

const SERIAL_DIGITS = 4
/** Hết số thứ tự 4 chữ số của một loại — 9.999 SP, gấp ~50 lần mức đang dùng. */
export const MAX_SERIAL = 10 ** SERIAL_DIGITS - 1

/** Nhận 4–6 chữ số để mã 6 số trên chứng từ cũ vẫn parse được (xem đầu file). */
const CODE_RE = /^([A-Z]{2})(\d{4,6})HG-([A-Z]{2})$/

export type ParsedCode = { type: string; serial: number; material: string }

/** Tách mã ra 3 phần. Mã cũ nhập tay không khớp dạng → null. */
export function parseProductCode(code: string): ParsedCode | null {
  const m = CODE_RE.exec(code.trim().toUpperCase())
  if (!m) return null
  return { type: m[1], serial: Number(m[2]), material: m[3] }
}

export function buildProductCode(type: string, serial: number, material: string): string {
  return `${type}${String(serial).padStart(SERIAL_DIGITS, '0')}HG-${material}`
}

/**
 * Số thứ tự kế tiếp của MỘT loại = max hiện có + 1 (không lấp khoảng trống — số
 * đã cấp là số đã in ra đơn hàng, tái sử dụng sẽ gây nhầm giữa hai sản phẩm).
 * Đếm chung cho mọi vật liệu: `CH000197HG-AL` tồn tại thì ghế inox kế tiếp là
 * `CH000198HG-IN`, không phải `CH000001HG-IN`.
 */
export function nextSerial(existingCodes: string[], type: string): number {
  let max = 0
  for (const c of existingCodes) {
    const p = parseProductCode(c)
    if (p?.type === type && p.serial > max) max = p.serial
  }
  return max + 1
}
