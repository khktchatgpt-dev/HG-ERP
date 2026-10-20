/**
 * IN BÁO GIÁ — luật thuần (07/10/2026, tầng 3 báo giá).
 *
 * Tờ báo giá là thứ GỬI KHÁCH, nên trên giấy phải nói rõ ba điều mà màn hình
 * biết còn giấy thì không: (1) đây là bản thứ mấy và thay cho bản nào — 0225
 * cho sửa đổi, khách cầm hai tờ cùng số phải phân biệt được; (2) tờ này còn
 * hiệu lực không — nháp / chờ duyệt / đã bị thay thế / đã huỷ in ra mà không
 * ghi gì là khách tưởng giá chốt; (3) số lượng chào (SL / MOQ) và thành tiền —
 * chỉ khi báo giá có khai SL, không bịa cột trống. Không chạm DB, không JSX.
 */
import { quoteNetPrice } from './quote-price'

/** Dải cảnh báo đỏ đầu tờ — null = tờ có hiệu lực, in sạch. */
export function quotePrintWatermark(
  status: string,
  validTo: string | null,
  today: string,
): string | null {
  switch (status) {
    case 'draft':
      return 'DRAFT — not yet issued, prices subject to change'
    case 'pending_approval':
      return 'PENDING INTERNAL APPROVAL — not yet valid'
    case 'rejected':
      return 'REJECTED INTERNALLY — not valid'
    case 'superseded':
      return 'SUPERSEDED — a newer revision of this quotation has been issued'
    case 'cancelled':
      return 'CANCELLED — not valid'
    case 'lost':
      return null // vẫn là tờ đã gửi; thua là chuyện nội bộ
    case 'won':
      return null // đã thành đơn — hết hạn không còn nghĩa
  }
  if (validTo && validTo < today)
    return `EXPIRED on ${isoToGb(validTo)} — please request a new quotation`
  return null
}

/** "Rev 2" từ bản 2 trở đi; bản đầu không in gì (đa số báo giá chỉ có một bản). */
export function quoteRevisionLabel(revisionNo: number | null | undefined): string | null {
  return revisionNo != null && revisionNo > 1 ? `Rev ${revisionNo}` : null
}

export type QuotePrintLineLike = {
  qty: number | null
  unit_price: number
  discount_pct: number | null
}

/**
 * Cột SL/MOQ + Thành tiền chỉ hiện khi CÓ dòng khai SL. Tổng chỉ cộng dòng có
 * SL; dòng không SL thì ghi "—" ở Thành tiền và chân bảng nói rõ tổng chưa gồm
 * những dòng đó (nguyên tắc 6: số nào không kiểm được thì không ai tin).
 */
export function quotePrintTotals(lines: QuotePrintLineLike[]): {
  showQty: boolean
  amounts: (number | null)[]
  total: number
  withQty: number
  withoutQty: number
} {
  const amounts = lines.map((l) =>
    l.qty != null && l.qty > 0
      ? l.qty * quoteNetPrice(l.unit_price, l.discount_pct)
      : null,
  )
  const withQty = amounts.filter((a) => a != null).length
  return {
    showQty: withQty > 0,
    amounts,
    total: amounts.reduce<number>((s, a) => s + (a ?? 0), 0),
    withQty,
    withoutQty: lines.length - withQty,
  }
}

/** Tên file PDF gợi ý: "BG-2026-0002 Rev 2 - YOTRIO" (không đuôi). */
export function quotePdfName(
  code: string,
  revisionNo: number | null | undefined,
  customer: string,
): string {
  const rev = quoteRevisionLabel(revisionNo)
  return [code, rev, '-', customer]
    .filter(Boolean)
    .join(' ')
    .replace(/[\\/:*?"<>|]/g, '')
}

const isoToGb = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
