'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Panel, Nhan, TD, NUM, Thanh } from '../../_erp/ui'
import { DocumentFiles } from '@/components/DocumentFiles'
import { shipWeekLabel } from '@/lib/ship-week'
import {
  fmtD,
  fmtDT,
  fmtN,
  LSX_LABEL,
  Nhom,
  Truong,
  type ChangeView,
} from './don-hang.shared'
import type { DonHangCtx } from './useDonHang'

/* ── Tổng quan: ba nhóm có tên, 3 cột ở ≥ lg (tiêu chí ERP #3) ──────────── */
export function KhoiTongQuan({ d }: { d: DonHangCtx }) {
  const o = d.order
  const yn = (v: boolean | null) => (v == null ? null : v ? 'Cho phép' : 'Không')
  return (
    <Panel
      title="Tổng quan"
      label="Tổng quan"
      actions={
        d.canEdit && d.editable ? (
          <Link
            href={`/sales/orders/${o.id}/edit`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Sửa điều khoản
          </Link>
        ) : undefined
      }
      note={
        d.contractMissing.length ? (
          <span className="text-[var(--warn)]">
            Hợp đồng in sẽ thiếu: {d.contractMissing.join(' · ')}
          </span>
        ) : undefined
      }
    >
      <div className="grid gap-x-6 gap-y-3 px-3 py-2 lg:grid-cols-3">
        <Nhom title="Chung">
          <Truong label="Khách hàng">
            <Link
              href={`/sales/customers/${o.customer_id}`}
              className="text-[var(--primary)] hover:underline"
            >
              {o.customer_name}
            </Link>
          </Truong>
          <Truong label="PO khách" mono>
            {o.customer_po_no}
          </Truong>
          <Truong label="Từ báo giá" mono>
            {o.quote_code}
          </Truong>
          <Truong label="Người phụ trách">{o.owner_name}</Truong>
          <Truong label="Ngày tạo" mono>
            {fmtD(o.created_at)}
          </Truong>
          <Truong label="Container">{o.container_summary}</Truong>
        </Nhom>
        <Nhom title="Giao hàng">
          <Truong label="Hạn giao" mono>
            {o.due_date ? `${shipWeekLabel(o.due_date)} · ${fmtD(o.due_date)}` : null}
          </Truong>
          <Truong label="Incoterm">{o.price_term}</Truong>
          <Truong label="Cảng xếp">{o.port_of_loading}</Truong>
          <Truong label="Cảng dỡ">{o.port_of_discharge}</Truong>
          <Truong label="Giao từng phần">{yn(o.partial_shipment)}</Truong>
          <Truong label="Chuyển tải">{yn(o.transhipment)}</Truong>
          <Truong label="Dung sai SL" mono>
            {o.qty_tolerance_pct != null ? `±${o.qty_tolerance_pct}%` : null}
          </Truong>
        </Nhom>
        <Nhom title="Thanh toán">
          <Truong label="Tiền tệ" mono>
            {o.currency}
          </Truong>
          <Truong label="Tỷ giá chốt" mono>
            {o.fx_rate ? `${fmtN(o.fx_rate)} ₫ · ${fmtD(o.fx_date)}` : null}
          </Truong>
          <Truong label="Đặt cọc" mono>
            {o.deposit_percent != null ? `${o.deposit_percent}%` : null}
          </Truong>
          <Truong label="Điều khoản TT">{o.payment_terms}</Truong>
          <Truong label="Phương thức">{o.payment_method}</Truong>
          <Truong label="Chứng từ yêu cầu">{o.required_docs}</Truong>
        </Nhom>
      </div>
      {o.note && (
        <div className="border-border text-foreground border-t px-3 py-2 text-[13px] whitespace-pre-wrap">
          <span className="text-muted-foreground mr-2 text-xs">Ghi chú:</span>
          {o.note}
        </div>
      )}
    </Panel>
  )
}

/* ── Đợt xuất đã ghi ──────────────────────────────────────────────────────── */
export function KhoiDotXuat({ d }: { d: DonHangCtx }) {
  const byLine = new Map(d.lines.map((l) => [l.id, l]))
  return (
    <Panel
      title="Đợt xuất đã ghi"
      count={d.shipments.length}
      label="Đợt xuất"
      note={`Đã xuất ${fmtN(d.tong.shipped)} / ${fmtN(d.tong.qty)} — còn ${fmtN(d.tong.left)}`}
      actions={
        d.canShipNow ? (
          <button
            type="button"
            onClick={() => d.open('ship')}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            + Ghi xuất
          </button>
        ) : undefined
      }
    >
      {d.shipments.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa có đợt xuất nào.{' '}
          {d.canShipNow
            ? 'Hàng rời xưởng thì bấm "Ghi xuất hàng" ở thanh trên.'
            : d.editable
              ? 'Người có quyền ghi xuất (Sale) sẽ ghi khi hàng rời xưởng.'
              : ''}
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border-border bg-muted text-muted-foreground h-8 border-b px-3 text-left text-xs font-semibold">
                Ngày
              </th>
              <th className="border-border bg-muted text-muted-foreground h-8 border-b px-3 text-left text-xs font-semibold">
                Mã SP
              </th>
              <th className="border-border bg-muted text-muted-foreground h-8 border-b px-3 text-right text-xs font-semibold">
                SL
              </th>
              <th className="border-border bg-muted text-muted-foreground h-8 border-b px-3 text-left text-xs font-semibold">
                Cont / ghi chú
              </th>
              <th className="border-border bg-muted text-muted-foreground h-8 border-b px-3 text-left text-xs font-semibold">
                Người ghi
              </th>
              <th className="border-border bg-muted h-8 w-10 border-b" />
            </tr>
          </thead>
          <tbody>
            {d.shipments.map((s) => (
              <tr key={s.id}>
                <td className={`${TD} font-mono text-xs`}>{fmtD(s.shipped_at)}</td>
                <td className={`${TD} font-mono text-xs`}>
                  {byLine.get(s.order_line_id)?.product_code ?? '?'}
                </td>
                <td className={`${TD} ${NUM}`}>{fmtN(s.qty)}</td>
                <td className={`${TD} truncate text-xs`}>{s.note ?? ''}</td>
                <td className={`${TD} text-muted-foreground text-xs`}>
                  {s.created_by_name ?? ''}
                </td>
                <td className={`${TD} text-right`}>
                  {d.canShip && d.editable && (
                    <button
                      type="button"
                      onClick={() => void d.removeShipment(s)}
                      disabled={d.busy}
                      className="text-xs text-[var(--stop)] hover:underline"
                      aria-label={`Gỡ đợt xuất ${s.qty} ${byLine.get(s.order_line_id)?.product_code ?? ''}`}
                    >
                      Gỡ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

/* ── Lệnh sản xuất ─────────────────────────────────────────────────────────── */
export function KhoiLenh({ d }: { d: DonHangCtx }) {
  const l = d.lsx
  return (
    <Panel
      title="Lệnh sản xuất"
      label="Lệnh sản xuất"
      actions={
        l ? (
          <Link
            href={`/sales/lsx/${l.id}`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Mở lệnh
          </Link>
        ) : d.canIssueNow ? (
          <button
            type="button"
            onClick={() => d.open('issue')}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Phát lệnh
          </button>
        ) : undefined
      }
    >
      {!l ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          {d.order.status === 'confirmed'
            ? 'Chưa phát lệnh. Phát lệnh để xưởng bắt đầu.'
            : 'Đơn không có lệnh.'}
        </p>
      ) : (
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] font-semibold">{l.code}</span>
            <Nhan
              tone={
                l.status === 'completed'
                  ? 'done'
                  : l.status === 'rejected' || l.status === 'cancelled'
                    ? 'stop'
                    : l.status === 'pending_approval'
                      ? 'warn'
                      : 'neutral'
              }
            >
              {LSX_LABEL[l.status] ?? l.status}
            </Nhan>
          </div>
          <Truong label="Hạn xuất lệnh" mono>
            {fmtD(l.ship_date)}
          </Truong>
          <Truong label="Phát lệnh" mono>
            {fmtD(l.issued_at)}
          </Truong>
          <Truong label="GĐ duyệt" mono>
            {fmtD(l.approved_at)}
          </Truong>
          <Truong label="Nhận vật tư" mono>
            {fmtD(l.materials_received_at)}
          </Truong>
          <Truong label="Công đoạn">
            {l.jobs_total > 0 ? (
              <Thanh
                ratio={l.jobs_done / l.jobs_total}
                label={`${l.jobs_done}/${l.jobs_total}`}
                tone={l.jobs_done === l.jobs_total ? 'done' : undefined}
              />
            ) : (
              'chưa lên kế hoạch'
            )}
          </Truong>
          <Truong label="Hoàn thành" mono>
            {fmtD(l.completed_at)}
          </Truong>
          {l.rejected_reason && (
            <Truong label="Lý do từ chối">
              <span className="text-[var(--stop)]">{l.rejected_reason}</span>
            </Truong>
          )}
          {l.other_orders.length > 0 && (
            <Truong label="Đơn cùng lệnh">
              {l.other_orders.map((o, i) => (
                <span key={o.id}>
                  {i > 0 && ', '}
                  <Link
                    href={`/sales/orders/${o.id}`}
                    className="font-mono text-xs text-[var(--primary)] hover:underline"
                  >
                    {o.code}
                  </Link>
                </span>
              ))}
            </Truong>
          )}
        </div>
      )}
    </Panel>
  )
}

/* ── Lịch sử ───────────────────────────────────────────────────────────────── */
const FIELD_LABEL: Record<string, string> = {
  customer_po_no: 'PO khách',
  due_date: 'Hạn giao',
  deposit_percent: 'Đặt cọc %',
  price_term: 'Incoterm',
  payment_terms: 'Điều khoản TT',
  payment_method: 'Phương thức TT',
  container_summary: 'Container',
  note: 'Ghi chú',
  qty_tolerance_pct: 'Dung sai',
  partial_shipment: 'Giao từng phần',
  transhipment: 'Chuyển tải',
  port_of_loading: 'Cảng xếp',
  port_of_discharge: 'Cảng dỡ',
  required_docs: 'Chứng từ',
  status: 'Trạng thái',
}

const TYPE_TITLE: Record<string, string> = {
  update: 'Sửa đơn (khách thay đổi)',
  cancel: 'Huỷ đơn',
  delivered: 'Xác nhận đã giao',
  shipment: 'Ghi xuất hàng',
  shipment_removed: 'Gỡ đợt xuất',
  price_fill: 'Điền đơn giá',
  ship_status: 'Đổi trạng thái xuất',
  lsx_submitted: 'Trình GĐ duyệt lệnh',
  lsx_resubmitted: 'Trình duyệt lại lệnh',
  lsx_approved: 'GĐ duyệt lệnh',
  lsx_rejected: 'GĐ từ chối lệnh',
  lsx_order_added: 'Gộp đơn vào lệnh',
  lsx_order_removed: 'Gỡ đơn khỏi lệnh',
  production_completed: 'Xưởng hoàn thành lệnh',
}

function moTa(c: ChangeView): string {
  const t = c.change.type ?? 'update'
  const parts: string[] = []
  if (c.change.lsx_code) parts.push(c.change.lsx_code)
  if (t === 'price_fill' && c.change.count) parts.push(`${c.change.count} dòng`)
  if (t === 'shipment' && c.change.count) parts.push(`${c.change.count} dòng`)
  if (t === 'delivered' && c.change.total != null)
    parts.push(`đã xuất ${fmtN(c.change.shipped ?? 0)}/${fmtN(c.change.total)}`)
  if (c.change.fields) {
    for (const [f, v] of Object.entries(c.change.fields)) {
      if (f === 'status' && t !== 'ship_status') continue
      parts.push(
        `${FIELD_LABEL[f] ?? f}: ${String(v.from ?? '—')} → ${String(v.to ?? '—')}`,
      )
    }
  }
  if (c.change.lines != null) parts.push('danh sách SP thay đổi')
  if (c.note) parts.push(c.note)
  return parts.join(' · ')
}

export function KhoiLichSu({ d }: { d: DonHangCtx }) {
  const rows = useMemo(
    () => [...d.changes].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [d.changes],
  )
  return (
    <Panel title="Lịch sử" count={rows.length} label="Lịch sử">
      {rows.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-[13px]">
          Chưa có thay đổi nào.
        </p>
      ) : (
        <ul className="divide-border divide-y">
          {rows.map((c) => {
            const t = c.change.type ?? 'update'
            const tone =
              t === 'cancel' || t === 'lsx_rejected'
                ? 'text-[var(--stop)]'
                : t === 'delivered' ||
                    t === 'production_completed' ||
                    t === 'lsx_approved'
                  ? 'text-[var(--done)]'
                  : 'text-foreground'
            return (
              <li key={c.id} className="flex gap-3 px-3 py-1.5 text-[13px]">
                <span className="text-muted-foreground w-[110px] shrink-0 font-mono text-xs tabular-nums">
                  {fmtDT(c.created_at)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`font-medium ${tone}`}>{TYPE_TITLE[t] ?? t}</span>
                  {moTa(c) && <span className="text-muted-foreground"> — {moTa(c)}</span>}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {c.changed_by_name ?? 'hệ thống'}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

/* ── Tài liệu ──────────────────────────────────────────────────────────────── */
export function KhoiTaiLieu({ d }: { d: DonHangCtx }) {
  return (
    <Panel
      title="Tài liệu"
      label="Tài liệu"
      note="PO khách · báo giá PDF · packing list · invoice · B/L · C/O"
    >
      <div className="px-3 py-2">
        <DocumentFiles kind="sales_order" id={d.order.id} canEdit={d.canEdit} title="" />
      </div>
    </Panel>
  )
}
