/**
 * Dòng "LSX" và "Đơn hàng" trên PHIẾU IN / FILE EXCEL của đơn mua.
 *
 * Đơn gộp nhiều lệnh (0125) từng in đủ LSX ("09/26-27 - MX + 10/26-27 - MX")
 * nhưng "Đơn hàng" chỉ lấy đơn khách của LỆNH CHÍNH — PO-2026-0100 in
 * "18056 HG-MX" trong khi lệnh 10 là của đơn 18064 (đo 27/09/2026). NCC và kho
 * đọc phiếu thì tưởng cả đơn chỉ phục vụ một đơn khách.
 *
 * Thứ tự: lệnh chính trước, rồi lệnh gộp theo thứ tự đưa vào; đơn khách bỏ trùng
 * (hai lệnh cùng một đơn khách thì in một lần).
 */
export type LsxRef = { code: string; order_codes: string[] }

export function poLsxRefs(
  main: LsxRef | null,
  extras: LsxRef[],
): { lsx_code: string | null; order_code: string | null } {
  const all = [...(main ? [main] : []), ...extras]
  const codes = [...new Set(all.map((l) => l.code).filter(Boolean))]
  const orders = [...new Set(all.flatMap((l) => l.order_codes).filter(Boolean))]
  return {
    lsx_code: codes.length ? codes.join(' + ') : null,
    order_code: orders.length ? orders.join(' + ') : null,
  }
}

/**
 * Dòng "Điều chỉnh" trên khung Số ĐH của phiếu in (27/09/2026). Đơn đã gửi mà
 * điều chỉnh (0210) thì in lại phiếu ra bản MỚI — trước đây không có dấu gì
 * phân biệt, NCC cầm hai tờ cùng số PO không biết tờ nào đang hiệu lực.
 * Không điều chỉnh lần nào → null (phiếu không in dòng này).
 */
export function poRevisionLabel(adjs: { seq: number; created_at: string }[]): string | null {
  if (adjs.length === 0) return null
  const last = adjs.reduce((a, b) => (b.seq > a.seq ? b : a))
  const d = new Date(last.created_at)
  const vn = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d) // prettier-ignore
  return `lần ${last.seq} · ${vn}`
}
