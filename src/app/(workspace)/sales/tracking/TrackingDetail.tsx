'use client'

import { Badge } from '@/components/Badge'
import { STATUS_LABEL } from '@/lib/order-progress'

/**
 * CHI TIẾT NHANH MỘT ĐƠN — mở ngay trên bảng Theo dõi.
 *
 * Màn Theo dõi trả lời được "đơn này tới đâu" ở mức một dòng, nhưng câu khách
 * hỏi qua điện thoại luôn cụ thể hơn: "mã X giao được bao nhiêu rồi, còn thiếu
 * mấy cái". Trước đây dòng đơn không bấm được — chỉ có link sang LỆNH SẢN XUẤT,
 * mà lệnh thì gộp nhiều đơn (0113) nên nhìn vào đó là nhìn ngược.
 *
 * Cố tình KHÔNG dùng lại `OrderDetailView` của Sales: bản đó cần 11 khối dữ
 * liệu (đề xuất gộp lệnh, tác động huỷ, lịch sử chỉnh sửa…) và kèm cả nút phát
 * lệnh / huỷ đơn. Ở đây chỉ cần đọc, và người mở có thể là Kế hoạch hay Ban GĐ
 * chứ không riêng Sales — nên chỉ lấy đúng phần trả lời khách, từ chính API
 * `/api/dept/sales/orders/[id]` đã có sẵn.
 */

export type DetailOrder = {
  id: string
  code: string
  status: string
  currency: string
  due_date: string | null
  customer_po_no: string | null
  note: string | null
}

export type DetailLine = {
  id: string
  qty: number
  unit_price: number
  ship_date: string | null
  product_code: string
  product_name: string
  product_unit: string
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
}

export type DetailShipment = {
  id: string
  order_line_id: string
  qty: number
  shipped_at: string
  created_by_name: string | null
}

const num = (n: number) => n.toLocaleString('vi-VN')
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—')

const BOM_TONE = { done: 'green', drawing: 'amber', none: 'gray' } as const
const BOM_LABEL = { done: 'Đủ', drawing: 'Đang vẽ', none: 'Chưa có' } as const

export function TrackingDetail({
  order,
  lines,
  shipments,
  shippedByLine,
  customerName,
  lsxCode,
  lsxHref,
}: {
  order: DetailOrder
  lines: DetailLine[]
  shipments: DetailShipment[]
  /** Σ đã thực xuất theo từng dòng (0120) — khoá theo `order_line_id`. */
  shippedByLine: Record<string, number>
  customerName: string
  lsxCode: string | null
  /** Link chi tiết LSX theo shell đang đứng — null = chưa phát lệnh. */
  lsxHref: string | null
}) {
  const total = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const qtyTotal = lines.reduce((s, l) => s + l.qty, 0)
  const shippedTotal = lines.reduce((s, l) => s + (shippedByLine[l.id] ?? 0), 0)

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge>{STATUS_LABEL[order.status] ?? order.status}</Badge>
        <span className="text-zinc-500">{customerName}</span>
        {order.customer_po_no && (
          <span className="text-zinc-500">· PO khách {order.customer_po_no}</span>
        )}
        <span className="text-zinc-500">· Hạn giao {day(order.due_date)}</span>
        {lsxHref && lsxCode && (
          <a
            href={lsxHref}
            className="font-mono text-blue-600 hover:underline dark:text-blue-400"
          >
            {lsxCode} →
          </a>
        )}
      </div>

      {/*
        Dòng tổng đứng TRƯỚC bảng: câu hỏi đầu tiên của khách là "xong bao nhiêu
        phần trăm", không phải "dòng thứ tư ra sao".
      */}
      <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs dark:bg-zinc-900">
        Đã xuất <b>{num(shippedTotal)}</b> / {num(qtyTotal)} sản phẩm
        {qtyTotal > 0 && (
          <span className="text-zinc-500">
            {' '}
            ({Math.round((shippedTotal / qtyTotal) * 100)}%)
          </span>
        )}{' '}
        · giá trị đơn <b>{num(total)}</b> {order.currency}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 uppercase dark:border-zinc-800">
              <th className="py-2 pr-2">Sản phẩm</th>
              <th className="w-20 py-2 pr-2 text-right">SL đặt</th>
              <th className="w-20 py-2 pr-2 text-right">Đã xuất</th>
              <th className="w-20 py-2 pr-2 text-right">Còn lại</th>
              <th className="w-24 py-2 pr-2">Hạn giao</th>
              <th className="w-20 py-2">BOM</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const shipped = shippedByLine[l.id] ?? 0
              const left = l.qty - shipped
              return (
                <tr key={l.id} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2">
                    <div className="flex flex-col">
                      <span>
                        <span className="font-mono text-xs text-zinc-400">
                          {l.product_code}
                        </span>{' '}
                        {l.product_name}
                      </span>
                      {l.customer_item_code && (
                        <span className="text-xs text-zinc-500">
                          mã khách {l.customer_item_code}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {num(l.qty)} {l.product_unit}
                  </td>
                  <td className="py-1.5 pr-2 text-right">{num(shipped)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {left > 0 ? (
                      <span className="font-medium text-amber-600">{num(left)}</span>
                    ) : (
                      <Badge tone="green">Đủ</Badge>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-xs">{day(l.ship_date)}</td>
                  <td className="py-1.5">
                    <Badge tone={BOM_TONE[l.bom_status]}>{BOM_LABEL[l.bom_status]}</Badge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Các đợt thực xuất (0120) — bằng chứng cho con số "đã xuất" ở trên. */}
      {shipments.length > 0 && (
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <b className="text-xs">Các đợt đã xuất</b>
          <ul className="mt-1.5 flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            {shipments.map((s) => {
              const line = lines.find((l) => l.id === s.order_line_id)
              return (
                <li key={s.id}>
                  {day(s.shipped_at)} · <b>{num(s.qty)}</b> {line?.product_code ?? '—'}
                  {s.created_by_name && ` · ${s.created_by_name}`}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {order.note && <p className="text-xs text-zinc-500">{order.note}</p>}
    </div>
  )
}
