'use client'

import Link from 'next/link'
import { Panel, Nhan } from '../../_erp/ui'
import { DocumentFiles } from '@/components/DocumentFiles'
import { orderStatusLabel, orderStatusTone } from '@/lib/order-status-ui'
import { QUOTE_LABEL, quoteTone } from '../so-bao-gia.shared'
import {
  BTN_PRI,
  BTN_STOP,
  BTN_SUB,
  fmtD,
  fmtDT,
  INPUT,
  Nhom,
  TEXTAREA,
  Truong,
} from './bao-gia.shared'
import type { BaoGiaCtx } from './useBaoGia'

function Chan({
  d,
  label,
  blocked,
  onSubmit,
  stop,
}: {
  d: BaoGiaCtx
  label: string
  blocked: string | null
  onSubmit: () => void
  stop?: boolean
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSubmit}
        disabled={d.busy || !!blocked}
        className={stop ? BTN_STOP : BTN_PRI}
        aria-busy={d.busy}
      >
        {d.busy ? 'Đang ghi…' : label}
      </button>
      <button type="button" onClick={d.close} disabled={d.busy} className={BTN_SUB}>
        Đóng
      </button>
      {(d.err ?? blocked) && (
        <span
          className={`text-xs ${d.err ? 'text-[var(--stop)]' : 'text-[var(--warn)]'}`}
        >
          {d.err ?? blocked}
        </span>
      )}
    </div>
  )
}

/* ── Hành động tại chỗ ──────────────────────────────────────────────────── */
export function KhoiBaoGiaHanhDong({ d }: { d: BaoGiaCtx }) {
  if (!d.panel) return null
  return (
    <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
      {d.panel === 'lost' && (
        <div className="max-w-2xl">
          <h3 className="text-foreground mb-1 text-[14px] font-semibold">
            Đánh dấu thua — {d.quote.code}
          </h3>
          <p className="text-muted-foreground mb-2 text-xs">
            Khách không chọn. Ghi vì sao (giá, mẫu, thời gian…) để lần sau chào đúng hơn.
            Vẫn lập được bản sửa đổi sau đó.
          </p>
          <textarea
            value={d.lostReason}
            onChange={(e) => d.setLostReason(e.target.value)}
            rows={2}
            maxLength={1000}
            className={TEXTAREA}
            placeholder="vd: đối thủ rẻ hơn 8%, khách dời sang mùa sau"
          />
          <Chan
            d={d}
            label="Thua"
            stop
            blocked={d.lostReason.trim() ? null : 'Nhập lý do thua'}
            onSubmit={() => void d.markLost()}
          />
        </div>
      )}
      {d.panel === 'reject' && (
        <div className="max-w-2xl">
          <h3 className="text-foreground mb-1 text-[14px] font-semibold">
            Từ chối báo giá — {d.quote.code}
          </h3>
          <textarea
            value={d.rejectReason}
            onChange={(e) => d.setRejectReason(e.target.value)}
            rows={2}
            maxLength={1000}
            className={TEXTAREA}
            placeholder="Lý do để Sale sửa rồi trình lại"
          />
          <Chan
            d={d}
            label="Từ chối"
            stop
            blocked={d.rejectReason.trim() ? null : 'Nhập lý do'}
            onSubmit={() => void d.reject()}
          />
        </div>
      )}
      {d.panel === 'cancel' && (
        <div className="max-w-2xl">
          <h3 className="text-foreground mb-1 text-[14px] font-semibold">
            Huỷ báo giá — {d.quote.code}
          </h3>
          <p className="text-muted-foreground text-xs">
            Sale rút báo giá (không gửi nữa / gửi nhầm). Bất biến sau khi huỷ.
          </p>
          <Chan
            d={d}
            label="Huỷ báo giá"
            stop
            blocked={null}
            onSubmit={() => void d.cancel()}
          />
        </div>
      )}
      {d.panel === 'copy' && (
        <div className="max-w-2xl">
          <h3 className="text-foreground mb-1 text-[14px] font-semibold">
            Nhân bản báo giá — {d.quote.code}
          </h3>
          <p className="text-muted-foreground mb-2 text-xs">
            Thành báo giá NHÁP bản 1 (không nối chuỗi sửa đổi). Chọn khách nhận bản mới;
            khác khách thì điều khoản lấy mặc định của khách đó.
          </p>
          <label className="block text-xs">
            <span className="text-muted-foreground block">Khách hàng</span>
            <select
              value={d.copyCustomer}
              onChange={(e) => d.setCopyCustomer(e.target.value)}
              className={`${INPUT} w-[320px]`}
            >
              {d.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Chan d={d} label="Nhân bản" blocked={null} onSubmit={() => void d.copy()} />
        </div>
      )}
    </div>
  )
}

/* ── Tổng quan ──────────────────────────────────────────────────────────── */
export function KhoiBaoGiaTongQuan({ d }: { d: BaoGiaCtx }) {
  const q = d.quote
  return (
    <Panel
      title="Tổng quan"
      label="Tổng quan"
      actions={
        d.can.edit ? (
          <Link
            href={`/sales/quotes/${q.id}/edit`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            Sửa
          </Link>
        ) : undefined
      }
    >
      <div className="grid gap-x-6 gap-y-3 px-3 py-2 md:grid-cols-2 2xl:grid-cols-3">
        <Nhom title="Chung">
          <Truong label="Khách hàng">
            <Link
              href={`/sales/customers/${q.customer_id}`}
              className="text-[var(--primary)] hover:underline"
            >
              {q.customer_name}
            </Link>
          </Truong>
          <Truong label="Người lập">{q.owner_name}</Truong>
          <Truong label="Ngày lập" mono>
            {fmtD(q.created_at)}
          </Truong>
          <Truong label="Bản" mono>{`bản ${q.revision_no}`}</Truong>
        </Nhom>
        <Nhom title="Điều khoản">
          <Truong label="Tiền tệ" mono>
            {q.currency}
          </Truong>
          <Truong label="Incoterm">{q.price_term}</Truong>
          <Truong label="Thanh toán">{q.payment_terms}</Truong>
          <Truong label="Hiệu lực" mono>
            {q.valid_to ? (
              <span className={d.expired ? 'text-[var(--stop)]' : ''}>
                {fmtD(q.valid_from)} → {fmtD(q.valid_to)}
                {d.expired ? ' · đã hết' : ''}
              </span>
            ) : (
              <span className="text-[var(--warn)]">
                chưa khai — bắt buộc trước khi gửi
              </span>
            )}
          </Truong>
        </Nhom>
        <Nhom title="Duyệt & kết cục">
          <Truong label="Trình GĐ" mono>
            {q.submitted_at
              ? `${fmtDT(q.submitted_at)}${q.submitted_by_name ? ` · ${q.submitted_by_name}` : ''}`
              : null}
          </Truong>
          <Truong label="GĐ duyệt" mono>
            {q.approved_at
              ? `${fmtDT(q.approved_at)}${q.approved_by_name ? ` · ${q.approved_by_name}` : ''}`
              : null}
          </Truong>
          {q.rejected_reason && (
            <Truong label="GĐ từ chối">
              <span className="text-[var(--stop)]">{q.rejected_reason}</span>
            </Truong>
          )}
          {q.lost_reason && (
            <Truong label="Lý do thua">
              <span className="text-[var(--stop)]">{q.lost_reason}</span>
            </Truong>
          )}
        </Nhom>
      </div>
      {q.note && (
        <div className="border-border text-foreground border-t px-3 py-2 text-[13px] whitespace-pre-wrap">
          <span className="text-muted-foreground mr-2 text-xs">Ghi chú:</span>
          {q.note}
        </div>
      )}
    </Panel>
  )
}

/* ── Đơn + chuỗi bản + tài liệu ─────────────────────────────────────────── */
export function KhoiBaoGiaPhu({ d }: { d: BaoGiaCtx }) {
  return (
    <>
      <Panel
        title="Đơn hàng từ báo giá"
        count={d.orders.length}
        label="Đơn hàng"
        actions={
          d.can.order ? (
            <Link
              href={`/sales/orders/new?quote=${d.quote.id}`}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              + Tạo đơn
            </Link>
          ) : undefined
        }
      >
        {d.orders.length === 0 ? (
          <p className="text-muted-foreground px-3 py-3 text-[13px]">
            Chưa có đơn nào.{' '}
            {d.can.order
              ? 'Khách chốt thì bấm "Tạo đơn hàng" — SP + giá net nạp sẵn, chỉ nhập SL.'
              : ''}
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {d.orders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between px-3 py-1.5 text-[13px]"
              >
                <Link
                  href={`/sales/orders/${o.id}`}
                  className="font-mono text-xs text-[var(--primary)] hover:underline"
                >
                  {o.code}
                </Link>
                <Nhan tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Nhan>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel
        title="Các bản"
        count={d.revisions.length}
        label="Các bản"
        note="chuỗi sửa đổi — bản mới gửi khách thì bản trước ngừng hiệu lực"
      >
        <ul className="divide-border divide-y">
          {d.revisions.map((r) => (
            <li
              key={r.id}
              className={`flex items-center justify-between px-3 py-1.5 text-[13px] ${r.id === d.quote.id ? 'bg-[var(--accent)]/50' : ''}`}
            >
              <span>
                <span className="text-muted-foreground mr-2 font-mono text-xs">
                  bản {r.revision_no}
                </span>
                {r.id === d.quote.id ? (
                  <span className="font-mono text-xs">{r.code}</span>
                ) : (
                  <Link
                    href={`/sales/quotes/${r.id}`}
                    className="font-mono text-xs text-[var(--primary)] hover:underline"
                  >
                    {r.code}
                  </Link>
                )}
                <span className="text-muted-foreground ml-2 text-xs">
                  {fmtD(r.created_at)}
                </span>
              </span>
              <Nhan tone={quoteTone(r.status)}>{QUOTE_LABEL[r.status] ?? r.status}</Nhan>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel
        title="Tài liệu"
        label="Tài liệu"
        note="file báo giá gửi khách · bảng tính giá · thư khách"
      >
        <div className="px-3 py-2">
          <DocumentFiles kind="quote" id={d.quote.id} canEdit={d.canEdit} title="" />
        </div>
      </Panel>
    </>
  )
}
