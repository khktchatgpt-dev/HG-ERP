/**
 * "NHẬP CHO" — phiếu nhập kho nhập cho NCC nào, đơn mua nào, lệnh SX nào, đợt
 * giao nào (04/10/2026).
 *
 * Bảng `warehouse_docs` không có cột đơn / lệnh: phiếu nhập theo đơn chỉ nối
 * với đơn qua DÒNG SỔ (`warehouse_movements.po_line_id`). Trước ngày này bản in
 * 01-VT vì thế chỉ có người lập + vật tư — đọc phiếu không biết hàng về cho
 * lệnh nào. Thông tin này SUY RA lúc in (không ghi thêm vào DB) nên mọi phiếu
 * cũ tự đúng, và không có nguồn số thứ hai để lệch với đơn.
 *
 * Đơn gom nhiều lệnh (0125): in ĐỦ mọi lệnh của đơn, không bắt người nhập chọn
 * — chủ dự án duyệt 04/10/2026.
 */

export type NhapCho = {
  /** Tên NCC — thường một; phiếu lạ trải nhiều đơn thì nhiều. */
  ncc: string[]
  /** Mã đơn mua. */
  don: string[]
  /** Mã lệnh SX: lệnh chính + lệnh gom của đơn, cộng lệnh ghi thẳng trên dòng sổ (hoàn kho). */
  lenh: string[]
  /** Câu đợt giao; null = đơn không chia đợt (không in dòng). */
  dot: string | null
}

const vn = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Bỏ trùng + bỏ rỗng, GIỮ thứ tự xuất hiện (lệnh chính đứng đầu). */
export function gopMa(list: (string | null | undefined)[]): string[] {
  const out: string[] = []
  for (const v of list) {
    const s = v?.trim()
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

/** "Đợt 2/3 · hẹn 05/10/2026". */
export function dotGiaoText(seq: number, total: number, expectedDate: string): string {
  return `Đợt ${seq}/${total} · hẹn ${vn(expectedDate)}`
}

/** Phiếu không gắn đợt mà đơn CÓ chia đợt — hàng gấp / NCC chở ngoài lịch. */
export const NGOAI_DOT = 'Ngoài đợt'

/**
 * Câu đợt giao của phiếu: gắn đợt → "Đợt x/y · hẹn …"; không gắn mà đơn có
 * đợt → ngoài đợt; đơn không chia đợt → null.
 */
export function dotCuaPhieu(
  dot: { seq: number; expected_date: string } | null,
  tongDot: number,
): string | null {
  if (dot) return dotGiaoText(dot.seq, Math.max(tongDot, dot.seq), dot.expected_date)
  return tongDot > 0 ? NGOAI_DOT : null
}

/** Khối số hiệu bên phải đầu phiếu in: Đơn mua · Lệnh SX · Đợt giao. */
export function nhapChoRefs(n: NhapCho | null | undefined): [string, string][] {
  if (!n || (n.don.length === 0 && n.lenh.length === 0)) return []
  const out: [string, string][] = []
  if (n.don.length > 0) out.push(['Đơn mua:', n.don.join(', ')])
  out.push(['Lệnh SX:', n.lenh.length > 0 ? n.lenh.join(', ') : 'không theo lệnh'])
  if (n.dot) out.push(['Đợt giao:', n.dot])
  return out
}
