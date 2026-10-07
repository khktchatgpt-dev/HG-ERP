import type { OrderRow } from './OrdersManager'

/**
 * Hàm định dạng / xét dòng / ô hạn giao của sổ Đơn hàng — tách ra 07/10/2026
 * để OrdersManager không vượt trần dòng riêng (size-baseline). Logic thuần.
 */

export type Group = {
  id: string
  name: string
  orders: OrderRow[]
  /** Hạn sớm nhất trong nhóm (đơn còn mở) — dùng để xếp nhóm khi sort theo hạn. */
  earliestDue: string | null
  newest: string
}

export const fmtD = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—'
export const fmtN = (n: number) => n.toLocaleString('vi-VN')

/**
 * Tên gọi (chữ cuối) để nhét vừa ô hẹp: "Nguyễn T.Minh Hằng" → "Hằng". In đủ
 * họ tên trong ô hẹp 190px thì bị cắt thành "Nguyễn T.Min…" — vừa mất chữ vừa
 * không phân biệt được ai. Tên đầy đủ vẫn còn ở tooltip.
 */
export const shortName = (full: string) => full.trim().split(/\s+/).at(-1) ?? full

/** Chênh lệch ngày (b − a) trên chuỗi yyyy-mm-dd — cùng cách tính với LsxWorkbench. */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/** Đơn đã đóng thì hạn giao không còn là việc phải lo. */
export const isClosed = (o: OrderRow) =>
  o.status === 'delivered' || o.status === 'cancelled'
export const isLate = (o: OrderRow, today: string) =>
  !!o.due_date && o.due_date < today && !isClosed(o)

/**
 * PO khách có đáng một ô riêng không? Dữ liệu thật phần lớn là PO trùng hoặc
 * nằm gọn trong mã đơn (`18005 HG-MX` ⊃ `18005`) — in lại chỉ tổ nhiễu.
 */
export const poIsDistinct = (o: OrderRow) =>
  !!o.customer_po_no && !o.code.toLowerCase().includes(o.customer_po_no.toLowerCase())

/**
 * Cả cụm khách này chạy CHUNG một lệnh sản xuất? Sổ thật rất hay như vậy —
 * ROSCO 13 đơn cùng nằm trong lệnh `01/26-27 - ROSCO`, và bản cũ in lại đúng
 * chuỗi đó 13 lần trên 180px mỗi dòng. Chung lệnh thì nói MỘT lần ở dải khách,
 * ô của từng dòng để trống. Cụm một đơn không tính (không có gì để gộp).
 */
export function sharedLsx(g: Group): { id: string; code: string } | null {
  if (g.orders.length < 2) return null
  const first = g.orders[0]
  if (!first.lsx_id || !first.lsx_code) return null
  return g.orders.every((o) => o.lsx_id === first.lsx_id)
    ? { id: first.lsx_id, code: first.lsx_code }
    : null
}

/** Σ giá trị theo từng loại tiền → "1.250.000 USD · 300.000.000 VND". */
export function sumByCurrency(orders: OrderRow[]): string {
  const by = new Map<string, number>()
  for (const o of orders)
    if (o.total > 0) by.set(o.currency, (by.get(o.currency) ?? 0) + o.total)
  if (by.size === 0) return '—'
  return [...by.entries()].map(([cur, v]) => `${fmtN(v)} ${cur}`).join(' · ')
}

/* ── Hạn giao: ngày giữ màu thường, dòng phụ mới là cảnh báo ────────────────── */
export function DueCell({ o, today }: { o: OrderRow; today: string }) {
  if (!o.due_date) return <span className="text-muted-foreground">—</span>
  const days = daysBetween(today, o.due_date.slice(0, 10))
  return (
    <div>
      <div className="text-sm tabular-nums">{fmtD(o.due_date)}</div>
      {!isClosed(o) && days < 0 && (
        <div className="text-[11px] font-medium text-red-600">⚠ quá {-days} ngày</div>
      )}
      {!isClosed(o) && days >= 0 && days <= 7 && (
        <div className="text-[11px] font-medium text-amber-600">còn {days} ngày</div>
      )}
    </div>
  )
}
