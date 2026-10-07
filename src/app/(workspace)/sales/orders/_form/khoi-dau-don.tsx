'use client'

import { useMemo, useState } from 'react'
import { Tick } from '../../_erp/ui'
import { CURRENCIES, INPUT, O, type CustomerOption } from './don-form.shared'
import type { DonHangFormCtx } from './useDonHangForm'

/**
 * Dải đầu đơn (khuôn F): mỗi hàng đầu trang là một hàng lưới bị lấy mất, nên
 * đầu đơn co thành MỘT dải ô nhỏ — mã đơn · nguồn · khách · tiền tệ · PO · hạn
 * giao · container. Điều khoản + ghi chú nằm ở khối riêng gấp được.
 */
export function KhoiDauDon({ d }: { d: DonHangFormCtx }) {
  const edit = d.mode === 'edit'
  const o = d.order
  return (
    <div className="border-border bg-card flex flex-wrap items-end gap-x-4 gap-y-2 border-b px-6 py-2.5">
      {edit ? (
        <O label="Mã đơn" w="w-auto min-w-[130px]">
          <span className="font-mono text-[13px] leading-7 font-semibold whitespace-nowrap">
            {o!.code}
          </span>
        </O>
      ) : (
        <O label="Mã đơn *" htmlFor="f-code" w="w-[150px]">
          <input
            id="f-code"
            className={`${INPUT} font-mono`}
            value={d.code}
            onChange={(e) => d.setCode(e.target.value.toUpperCase())}
            placeholder="VD: HG-2026-001"
            autoFocus
          />
        </O>
      )}

      {edit ? (
        <O label="Khách hàng" w="w-[220px]">
          <span className="truncate text-[13px] leading-7">
            {o!.customer_name}
            {o!.quote_code && (
              <span className="text-muted-foreground"> · từ BG {o!.quote_code}</span>
            )}
          </span>
        </O>
      ) : (
        <>
          <O label="Nguồn" w="w-[150px]">
            <select
              className={INPUT}
              value={d.source}
              onChange={(e) => {
                const v = e.target.value as 'quote' | 'direct'
                d.setSource(v)
                if (v === 'direct') d.selectQuote('')
              }}
            >
              <option value="quote">Từ báo giá đã gửi</option>
              <option value="direct">Trực tiếp (không BG)</option>
            </select>
          </O>
          {d.source === 'quote' ? (
            <O label="Báo giá *" htmlFor="f-quote" w="w-[260px]">
              <select
                id="f-quote"
                className={INPUT}
                value={d.quoteId}
                onChange={(e) => d.selectQuote(e.target.value)}
                disabled={d.loadingQuote}
              >
                <option value="">— chọn báo giá —</option>
                {(d.sentQuotes ?? []).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.code} · {q.customer_name} · {q.currency}
                  </option>
                ))}
              </select>
            </O>
          ) : (
            <O label="Khách hàng *" htmlFor="f-customer" w="w-[260px]">
              <KhachCombo
                id="f-customer"
                customers={d.customers}
                value={d.customerId}
                onChange={d.pickCustomer}
              />
            </O>
          )}
        </>
      )}

      <O label="Tiền tệ" w="w-[80px]">
        {edit || d.source === 'quote' ? (
          <span className="font-mono text-[13px] leading-7">{d.currency}</span>
        ) : (
          <select
            className={INPUT}
            value={d.h.currency}
            onChange={(e) => d.set('currency', e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        )}
      </O>

      <O label="PO khách *" htmlFor="f-po" w="w-[170px]">
        <input
          id="f-po"
          className={`${INPUT} font-mono`}
          value={d.h.customer_po_no}
          onChange={(e) => d.set('customer_po_no', e.target.value)}
          placeholder={d.noPo ? '(không có PO)' : 'Số PO / order confirmation'}
          disabled={d.noPo}
        />
      </O>
      <div className="pb-1">
        <Tick checked={d.noPo} onChange={d.setNoPo}>
          không có PO
        </Tick>
      </div>

      <O label="Hạn giao (mặc định cho dòng)" htmlFor="f-due" w="w-[150px]">
        <input
          id="f-due"
          type="date"
          className={INPUT}
          value={d.h.due_date}
          onChange={(e) => d.set('due_date', e.target.value)}
        />
      </O>

      <O label="Container" w="w-[150px]">
        <input
          className={INPUT}
          value={d.h.container_summary}
          onChange={(e) => d.set('container_summary', e.target.value)}
          placeholder="VD: 2×40HC"
        />
      </O>
    </div>
  )
}

/** Ô chọn khách: gõ để lọc trong danh sách đang hoạt động, Enter chọn dòng đầu. */
function KhachCombo({
  id,
  customers,
  value,
  onChange,
}: {
  id: string
  customers: CustomerOption[]
  value: string
  onChange: (id: string) => void
}) {
  const chosen = customers.find((c) => c.id === value)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const hits = useMemo(() => {
    const k = q.trim().toLowerCase()
    if (!k) return customers.slice(0, 8)
    return customers.filter((c) => c.name.toLowerCase().includes(k)).slice(0, 8)
  }, [customers, q])
  return (
    <div className="relative">
      <input
        id={id}
        className={INPUT}
        value={open ? q : (chosen?.name ?? '')}
        placeholder="Gõ tên khách…"
        onFocus={() => {
          setQ('')
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && hits[0]) {
            e.preventDefault()
            onChange(hits[0].id)
            setOpen(false)
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') setOpen(false)
        }}
        autoComplete="off"
      />
      {open && (
        <ul className="border-border bg-card absolute top-full left-0 z-20 mt-0.5 max-h-60 w-[320px] overflow-auto rounded-sm border shadow-md">
          {hits.length === 0 && (
            <li className="text-muted-foreground px-2 py-1.5 text-[13px]">
              Không có khách khớp “{q}”
            </li>
          )}
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`hover:bg-muted flex w-full flex-col px-2 py-1 text-left text-[13px] ${c.id === value ? 'bg-[var(--accent)]' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(c.id)
                  setOpen(false)
                }}
              >
                <span className="truncate">{c.name}</span>
                <span className="text-muted-foreground text-[11px]">
                  {[c.default_currency, c.default_price_term, c.default_payment_terms]
                    .filter(Boolean)
                    .join(' · ') || 'chưa khai điều khoản mặc định'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
