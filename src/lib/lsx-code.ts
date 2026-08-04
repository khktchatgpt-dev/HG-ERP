/**
 * GỢI Ý SỐ LỆNH SẢN XUẤT theo cách Sales đang đánh số trong file thật:
 * `01/26 - Rosco` — số thứ tự trong năm của RIÊNG khách đó / 2 số cuối của năm
 * / tên gọn của khách (xem docs/lsx-redesign.md §1).
 *
 * Chỉ là GỢI Ý điền sẵn cho sửa: người dùng gõ đè thoải mái, chốt chặn trùng số
 * vẫn nằm ở DB (`production_orders.code` unique) và ở lsxService.issue.
 */

/** Các cụm chỉ loại hình doanh nghiệp, bỏ khỏi đầu tên khi lấy tên gọn. */
const LEGAL_PREFIXES: readonly (readonly string[])[] = [
  ['cong', 'ty'],
  ['cty'],
  ['tnhh'],
  ['mtv'],
  ['co', 'phan'],
  ['cp'],
  ['tap', 'doan'],
  ['dntn'],
  ['doanh', 'nghiep', 'tu', 'nhan'],
]

/** bỏ dấu + thường hoá, để so khớp "CỔ PHẦN" với "co phan". */
function plain(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // bỏ dấu thanh/dấu mũ tách ra sau NFD
    .replace(/đ/gi, 'd')
    .toLowerCase()
}

/**
 * Tên gọn của khách để ghép vào số lệnh: "CÔNG TY TNHH ROSCO VIỆT NAM" → "ROSCO",
 * "MERXX HANDELS GMBH" → "MERXX". Giữ nguyên kiểu chữ hoa/thường của nguồn.
 */
export function shortCustomerLabel(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return ''

  let i = 0
  let moved = true
  while (moved && i < tokens.length) {
    moved = false
    for (const p of LEGAL_PREFIXES) {
      if (p.every((w, k) => plain(tokens[i + k] ?? '') === w)) {
        i += p.length
        moved = true
        break
      }
    }
  }

  const first = tokens[i] ?? tokens[0]
  return first.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/**
 * Số lệnh kế tiếp của một khách trong năm.
 *
 * @param existingCodes mã của các lệnh ĐÃ PHÁT CHO CHÍNH KHÁCH ĐÓ (mọi năm —
 *   hàm tự lọc theo 2 số cuối của năm). Mã không theo mẫu `NN/YY` (dữ liệu cũ
 *   kiểu `LSX-2026-0001`) bị bỏ qua, không làm lệch số.
 */
export function suggestLsxCode(opts: {
  customerName: string
  existingCodes: readonly string[]
  year: number
}): string {
  const yy = String(opts.year % 100).padStart(2, '0')
  let max = 0
  for (const code of opts.existingCodes) {
    const m = /^\s*0*(\d{1,3})\s*\/\s*(\d{2})(?!\d)/.exec(code)
    if (m && m[2] === yy) max = Math.max(max, Number(m[1]))
  }
  const seq = String(max + 1).padStart(2, '0')
  const label = shortCustomerLabel(opts.customerName)
  return label ? `${seq}/${yy} - ${label}` : `${seq}/${yy}`
}
