'use client'

import { ChevronDown, ChevronRight, Save, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { PRICE_NAME } from '@/lib/sale-price'
import { ErpHeader, ErpPage, Nhan, ToolBtn } from '../../_erp/ui'
import { NutAnGiaNoiBo, useAnGiaNoiBo } from '../../_erp/gia-noi-bo'
import { goPrice, KhoiLuoiBaoGia } from './khoi-luoi'
import {
  BTN_PRI,
  BTN_SUB,
  CURRENCIES,
  fmtMoney,
  INPUT,
  O,
} from '../../orders/_form/don-form.shared'
import { KhachCombo } from '../../orders/_form/khoi-dau-don'
import {
  useBaoGiaForm,
  type BaoGiaFormCtx,
  type BaoGiaFormProps,
} from './useBaoGiaForm'

/**
 * Form LẬP / SỬA BÁO GIÁ — khuôn F (Bảng nhập liệu, kiểu ERP — 07/10/2026).
 * Dải đầu đơn một hàng (khách · tiền tệ · hiệu lực · Incoterm · thanh toán),
 * lưới dòng là nhân vật chính (Enter xuống dòng, giá chào · giá vốn KH · lãi thực ngay
 * trên lưới khi có quyền), thanh chốt đáy nói còn thiếu gì bằng câu bấm được.
 * Thay `components/sales/QuoteForm.tsx` (thẻ bo tròn nổi, theme v3).
 */
export function BaoGiaForm(props: BaoGiaFormProps) {
  const d = useBaoGiaForm(props)
  const an = useAnGiaNoiBo()
  const edit = d.mode === 'edit'
  const back = edit ? `/sales/quotes/${d.initial!.id}` : '/sales/quotes'
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Báo giá', href: '/sales/quotes' },
          ...(edit ? [{ label: d.initial!.code, href: back }] : []),
        ]}
        title={edit ? `Sửa báo giá ${d.initial!.code}` : 'Lập báo giá'}
        sub={
          edit
            ? 'Chỉ sửa được khi còn nháp / bị từ chối. Lưu xong trình GĐ hoặc gửi khách.'
            : 'Chọn SP, chào đơn giá (và CK, SL/MOQ nếu có). Lưu thành NHÁP rồi gửi khách.'
        }
        actions={
          <>
            {d.canSeeCost && <NutAnGiaNoiBo hidden={an.hidden} onToggle={an.toggle} />}
            <ToolBtn href={back} icon={X}>
              Huỷ
            </ToolBtn>
            <ToolBtn onClick={d.submit} icon={Save} primary>
              {edit ? 'Lưu thay đổi' : 'Lưu báo giá nháp'}
            </ToolBtn>
          </>
        }
      />
      <DauDon d={d} />
      <KhoiLuoiBaoGia d={d} />
      <CommitBar d={d} back={back} />
    </ErpPage>
  )
}

/* ── Dải đầu đơn: một hàng ô nhỏ ───────────────────────────────────────── */
function DauDon({ d }: { d: BaoGiaFormCtx }) {
  const edit = d.mode === 'edit'
  return (
    <>
      <div className="border-border bg-card flex flex-wrap items-end gap-x-4 gap-y-2 border-b px-6 py-2.5">
        {edit ? (
          <O label="Số BG" w="w-auto min-w-[120px]">
            <span className="font-mono text-[13px] leading-7 font-semibold whitespace-nowrap">
              {d.initial!.code}
            </span>
          </O>
        ) : null}
        <O label="Khách hàng *" htmlFor="f-customer" w="w-[280px]">
          <KhachCombo
            id="f-customer"
            customers={d.customers.map((c) => ({ ...c, port_of_discharge: null }))}
            value={d.customerId}
            onChange={d.pickCustomer}
          />
        </O>
        <O label="Tiền tệ" w="w-[80px]">
          <select
            className={INPUT}
            value={d.h.currency}
            onChange={(e) => d.set('currency', e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </O>
        <O label="Hiệu lực từ" w="w-[140px]">
          <input
            type="date"
            className={INPUT}
            value={d.h.valid_from}
            onChange={(e) => d.set('valid_from', e.target.value)}
          />
        </O>
        <O label="Đến ngày *" htmlFor="f-valid-to" w="w-[140px]">
          <input
            id="f-valid-to"
            type="date"
            className={`${INPUT} ${d.h.valid_from && d.h.valid_to && d.h.valid_from > d.h.valid_to ? 'border-[var(--stop)]' : ''}`}
            value={d.h.valid_to}
            onChange={(e) => d.set('valid_to', e.target.value)}
          />
        </O>
        <O label="Incoterm" w="w-[150px]">
          <input
            className={INPUT}
            value={d.h.price_term}
            maxLength={100}
            placeholder="FOB Quy Nhon"
            onChange={(e) => d.set('price_term', e.target.value)}
          />
        </O>
        <O label="Thanh toán" w="min-w-[220px] flex-1">
          <input
            className={INPUT}
            value={d.h.payment_terms}
            maxLength={500}
            placeholder="L/C at sight · 30% deposit…"
            onChange={(e) => d.set('payment_terms', e.target.value)}
          />
        </O>
      </div>
      <div className="border-border bg-card border-b">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-6 py-1.5 text-left text-xs font-semibold tracking-wide uppercase"
          onClick={() => d.setTermsOpen(!d.termsOpen)}
        >
          {d.termsOpen ? (
            <ChevronDown className="size-3.5" strokeWidth={1.8} />
          ) : (
            <ChevronRight className="size-3.5" strokeWidth={1.8} />
          )}
          Ghi chú báo giá
          {!d.termsOpen && d.h.note && (
            <span className="truncate font-normal normal-case">· {d.h.note}</span>
          )}
        </button>
        {d.termsOpen && (
          <div className="px-6 pb-2">
            <textarea
              className={`${INPUT} h-12 resize-y py-1`}
              value={d.h.note}
              maxLength={2000}
              placeholder="Điều kiện kèm theo, ghi chú in lên tờ báo giá (Remark)"
              onChange={(e) => d.set('note', e.target.value)}
            />
          </div>
        )}
      </div>
    </>
  )
}

/* ── Thanh chốt đáy ────────────────────────────────────────────────────── */
function CommitBar({ d, back }: { d: BaoGiaFormCtx; back: string }) {
  const edit = d.mode === 'edit'
  const an = useAnGiaNoiBo()
  const go = (id?: string) => {
    if (!id) return
    const el = document.getElementById(id)
    el?.scrollIntoView({ block: 'center' })
    el?.focus()
  }
  return (
    <div className="border-border bg-card sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t px-6 py-2">
      <span className="text-[13px]">
        <span className="font-mono font-semibold tabular-nums">{d.lines.length}</span>
        <span className="text-muted-foreground"> dòng</span>
        {d.tong.ref > 0 && (
          <>
            <span className="text-muted-foreground"> · tham chiếu </span>
            <span className="font-mono font-semibold tabular-nums">
              {fmtMoney(d.tong.ref)} {d.h.currency}
            </span>
          </>
        )}
        {d.canSeeCost && !an.hidden && d.tong.below > 0 && (
          <button
            type="button"
            className="ml-2"
            onClick={() => goPrice(d.tong.firstBelow)}
          >
            <Nhan tone="stop">
              {d.tong.below} dòng dưới {PRICE_NAME.cost}
            </Nhan>
          </button>
        )}
      </span>
      <span className="bg-border h-4 w-px" />
      {d.invalid ? (
        <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
          <span className="text-[var(--stop)]">Còn thiếu:</span>
          {d.missing.map((m, i) => (
            <button
              key={i}
              type="button"
              className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
              onClick={() => go(m.focus)}
            >
              {m.msg}
            </button>
          ))}
        </span>
      ) : (
        <span className="text-[13px] text-[var(--done)]">
          Đủ điều kiện lưu{edit ? '' : ' — lưu thành NHÁP, gửi khách ở trang báo giá'}
        </span>
      )}
      <span className="flex-1" />
      <a href={back} className={BTN_SUB}>
        Huỷ
      </a>
      <button
        type="button"
        className={BTN_PRI}
        disabled={d.busy || d.invalid}
        onClick={d.submit}
      >
        <Save className="size-4" strokeWidth={1.8} />
        {d.busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Lưu báo giá nháp'}
      </button>
    </div>
  )
}
