'use client'

import { Fragment, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, Plus, Save, Search, Trash2, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { ProductSearchDialog } from '@/components/sales/ProductSearchDialog'
import { QuickAddProduct } from '@/components/sales/QuickAddProduct'
import { hasNoSpec } from '@/components/sales/ProductSpecFill'
import {
  BOM_LABEL,
  dimStr,
  inchStr,
  QuoteLineDetails,
} from '@/components/sales/quote-form.shared'
import { ErpHeader, ErpPage, Nhan, ToolBtn } from '../../_erp/ui'
import {
  BTN_PRI,
  BTN_SUB,
  CELL,
  CURRENCIES,
  fmtMoney,
  INPUT,
  num,
  O,
} from '../../orders/_form/don-form.shared'
import { KhachCombo } from '../../orders/_form/khoi-dau-don'
import {
  useBaoGiaForm,
  type BaoGiaFormCtx,
  type BaoGiaFormProps,
  type LineRow,
} from './useBaoGiaForm'

const TH =
  'h-7 border-b border-border bg-muted px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase'
const TD = 'h-[40px] border-b border-border px-1.5 align-middle text-[13px]'
const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'

type Col = 'sp' | 'qty' | 'price' | 'ck' | 'note'
/** Enter / ↓ xuống cùng cột, ↑ lên — ô đánh dấu bằng data-r / data-c. */
function gridKey(e: KeyboardEvent<HTMLElement>, r: number, c: Col) {
  if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const nr = e.key === 'ArrowUp' ? r - 1 : r + 1
  const el = document.querySelector<HTMLElement>(`[data-r="${nr}"][data-c="${c}"]`)
  if (el) {
    e.preventDefault()
    el.focus()
    if (el instanceof HTMLInputElement) el.select()
  }
}

/**
 * Form LẬP / SỬA BÁO GIÁ — khuôn F (Bảng nhập liệu, kiểu ERP — 07/10/2026).
 * Dải đầu đơn một hàng (khách · tiền tệ · hiệu lực · Incoterm · thanh toán),
 * lưới dòng là nhân vật chính (Enter xuống dòng, giá thành KH · net · lãi ngay
 * trên lưới khi có quyền), thanh chốt đáy nói còn thiếu gì bằng câu bấm được.
 * Thay `components/sales/QuoteForm.tsx` (thẻ bo tròn nổi, theme v3).
 */
export function BaoGiaForm(props: BaoGiaFormProps) {
  const d = useBaoGiaForm(props)
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
      <LuoiDong d={d} />
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

/* ── Lưới dòng ─────────────────────────────────────────────────────────── */
function LuoiDong({ d }: { d: BaoGiaFormCtx }) {
  const cost = d.canSeeCost
  const cols = 10 + (cost ? 2 : 0)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border bg-card flex flex-wrap items-center gap-2 border-b px-6 py-1.5">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Dòng sản phẩm · {d.lines.length}
        </span>
        <span className="bg-border mx-1 h-4 w-px" />
        <button
          id="btn-pick"
          type="button"
          className={BTN_SUB}
          disabled={!d.customerId}
          title={d.customerId ? undefined : 'Chọn khách hàng trước'}
          onClick={() => {
            d.setReplaceKey(null)
            d.setPickOpen(true)
          }}
        >
          <Search className="size-3.5" strokeWidth={1.8} /> Chọn SP từ thư viện
        </button>
        <button type="button" className={BTN_SUB} onClick={d.addEmpty}>
          <Plus className="size-3.5" strokeWidth={1.8} /> Dòng trống
        </button>
        <QuickAddProduct customerId={d.customerId || null} onCreated={d.addQuick} />
        <span className="flex-1" />
        {d.tong.noSpec > 0 && (
          <span className="text-xs text-[var(--warn)]">
            {d.tong.noSpec} SP thiếu quy cách — mở ▾ để điền
          </span>
        )}
        {cost && d.tong.below > 0 && (
          <span className="text-xs text-[var(--stop)]">
            {d.tong.below} dòng dưới giá thành KH
          </span>
        )}
        {!cost && (
          <span className="text-muted-foreground text-xs">
            Giá thành KH chỉ hiện với người có quyền xem
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col />
            <col className="w-[110px]" />
            <col className="w-12" />
            <col className="w-[84px]" />
            {cost && <col className="w-[96px]" />}
            <col className="w-[104px]" />
            <col className="w-[64px]" />
            <col className="w-[96px]" />
            {cost && <col className="w-[64px]" />}
            <col className="w-[180px]" />
            <col className="w-[60px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Sản phẩm</th>
              <th className={TH}>Mã khách</th>
              <th className={TH}>ĐVT</th>
              <th className={`${TH} text-right`}>SL/MOQ</th>
              {cost && <th className={`${TH} text-right`}>Giá thành</th>}
              <th className={`${TH} text-right`}>Đơn giá ({d.h.currency}) *</th>
              <th className={`${TH} text-right`}>CK%</th>
              <th className={`${TH} text-right`}>Giá chào</th>
              {cost && <th className={`${TH} text-right`}>Lãi</th>}
              <th className={TH}>Ghi chú</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {d.lines.length === 0 && (
              <tr>
                <td
                  colSpan={cols}
                  className="text-muted-foreground px-6 py-10 text-center text-[13px]"
                >
                  {d.customerId
                    ? 'Chưa có dòng nào. Chọn SP từ thư viện (nhiều mã một lượt) hoặc tạo SP mới.'
                    : 'Chọn khách hàng trước — giá đã chào cho khách đó sẽ tự điền.'}
                </td>
              </tr>
            )}
            {d.lines.map((l, i) => (
              <Dong key={l.key} d={d} l={l} i={i} cols={cols} />
            ))}
          </tbody>
          {d.lines.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-muted text-[12px] font-medium">
                <td className="border-border h-8 border-t px-2" colSpan={4}>
                  <span className="text-muted-foreground">
                    Cộng {d.lines.length} dòng
                    {d.tong.withQty < d.lines.length &&
                      ` · ${d.lines.length - d.tong.withQty} chưa có SL`}
                  </span>
                </td>
                <td className={`border-border h-8 border-t px-1.5 ${NUM}`}>
                  {d.lines.reduce((s, l) => s + num(l.qty), 0).toLocaleString('en-US')}
                </td>
                {cost && <td className="border-border h-8 border-t" />}
                <td className="border-border h-8 border-t" colSpan={2} />
                <td className={`border-border h-8 border-t px-1.5 ${NUM}`}>
                  {d.tong.ref > 0 ? fmtMoney(d.tong.ref) : '—'}
                </td>
                {cost && <td className="border-border h-8 border-t" />}
                <td className="border-border h-8 border-t" colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ProductSearchDialog
        open={d.pickOpen}
        onOpenChange={d.setPickOpen}
        customerId={d.customerId || null}
        usedIds={d.usedIds}
        multi={d.replaceKey == null}
        title={
          d.replaceKey == null ? 'Chọn sản phẩm vào báo giá' : 'Đổi sản phẩm của dòng'
        }
        onConfirm={(ps) => {
          if (d.replaceKey != null) {
            if (ps[0]) d.replaceProduct(d.replaceKey, ps[0])
          } else d.addPicked(ps)
          d.setPickOpen(false)
          d.setReplaceKey(null)
        }}
      />
    </div>
  )
}

function Dong({
  d,
  l,
  i,
  cols,
}: {
  d: BaoGiaFormCtx
  l: LineRow
  i: number
  cols: number
}) {
  const p = l.productId ? d.known.get(l.productId) : undefined
  const pk = p?.packing ?? {}
  const { net, cost, margin } = d.calc(l)
  const open = d.openKeys.has(l.key)
  const mine = l.productId ? d.lastPrices.get(l.productId) : undefined
  const market = l.productId ? d.marketPrices.get(l.productId) : undefined
  const noSpec = p ? hasNoSpec(p) : false
  const under = d.canSeeCost && cost != null && net > 0 && net < cost
  const specs: [string, string | null][] = [
    ['Mã KH đặt', p?.customer_item_code ?? null],
    ['KT SP (cm)', dimStr(pk.l_cm, pk.w_cm, pk.h_cm)],
    ['Carton (cm)', dimStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)],
    ['Carton (inch)', inchStr(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)],
    ['SL/ctn', pk.qty_per_carton != null ? String(pk.qty_per_carton) : null],
    ['Loading 40HC', pk.loading_40hc != null ? String(pk.loading_40hc) : null],
    [
      'NW/GW (kg)',
      pk.nw_kg != null || pk.gw_kg != null
        ? `${pk.nw_kg ?? '—'} / ${pk.gw_kg ?? '—'}`
        : null,
    ],
  ]
  return (
    <Fragment>
      <tr className="hover:bg-muted/40">
        <td className={`${TD} text-muted-foreground text-right font-mono text-xs`}>
          {i + 1}
        </td>
        <td className={`${TD} min-w-0`}>
          <button
            id={`cell-${l.key}-sp`}
            type="button"
            data-r={i}
            data-c="sp"
            onKeyDown={(e) => gridKey(e, i, 'sp')}
            className={`flex w-full min-w-0 flex-col text-left ${p ? '' : 'text-[var(--stop)]'}`}
            onClick={() => {
              d.setReplaceKey(l.key)
              d.setPickOpen(true)
            }}
            title={p ? 'Bấm để đổi SP' : 'Bấm để chọn SP'}
          >
            {p ? (
              <>
                <span
                  className="block truncate text-[13px] leading-4 font-medium"
                  title={p.name}
                >
                  {p.name}
                </span>
                <span className="text-muted-foreground flex items-center gap-1.5 truncate text-[11px] leading-4">
                  <span className="font-mono">{p.code}</span>
                  <span>· {BOM_LABEL[p.bom_status]}</span>
                  {noSpec && <span className="text-[var(--warn)]">thiếu quy cách</span>}
                  {mine && (
                    <span>
                      khách này lần trước {mine.unit_price.toLocaleString('en-US')} (
                      {mine.quote_code})
                    </span>
                  )}
                  {!mine && market && (
                    <span>
                      gần nhất {market.unit_price.toLocaleString('en-US')}{' '}
                      {market.currency} · {market.customer_name}
                    </span>
                  )}
                </span>
              </>
            ) : (
              'Chưa chọn SP — bấm để chọn'
            )}
          </button>
        </td>
        <td
          className={`${TD} text-muted-foreground truncate font-mono text-xs`}
          title={p?.customer_item_code ?? ''}
        >
          {p?.customer_item_code ?? ''}
        </td>
        <td className={`${TD} text-muted-foreground text-xs`}>{p?.unit ?? ''}</td>
        <td className={`${TD} px-1`}>
          <input
            data-r={i}
            data-c="qty"
            className={`${CELL} ${NUM}`}
            value={l.qty}
            inputMode="numeric"
            placeholder="—"
            onChange={(e) => d.setLine(l.key, { qty: e.target.value })}
            onKeyDown={(e) => gridKey(e, i, 'qty')}
            aria-label="SL dự kiến / MOQ"
          />
        </td>
        {d.canSeeCost && (
          <td className={`${TD} ${NUM} text-muted-foreground`}>
            {cost != null ? fmtMoney(cost) : '—'}
          </td>
        )}
        <td className={`${TD} px-1`}>
          <input
            id={`cell-${l.key}-price`}
            data-r={i}
            data-c="price"
            className={`${CELL} ${NUM} ${l.productId && l.unitPrice.trim() === '' ? 'border-[var(--stop)]' : under ? 'border-[var(--stop)]' : ''}`}
            value={l.unitPrice}
            inputMode="decimal"
            onChange={(e) => d.setLine(l.key, { unitPrice: e.target.value })}
            onKeyDown={(e) => gridKey(e, i, 'price')}
            aria-label="Đơn giá"
            title={under ? `Dưới giá thành KH ${fmtMoney(cost!)}` : undefined}
          />
        </td>
        <td className={`${TD} px-1`}>
          <input
            id={`cell-${l.key}-ck`}
            data-r={i}
            data-c="ck"
            className={`${CELL} ${NUM}`}
            value={l.discount}
            inputMode="decimal"
            placeholder="0"
            onChange={(e) => d.setLine(l.key, { discount: e.target.value })}
            onKeyDown={(e) => gridKey(e, i, 'ck')}
            aria-label="Chiết khấu %"
          />
        </td>
        <td className={`${TD} ${NUM} font-medium ${under ? 'text-[var(--stop)]' : ''}`}>
          {net > 0 ? fmtMoney(net) : '—'}
        </td>
        {d.canSeeCost && (
          <td
            className={`${TD} ${NUM} ${margin == null ? 'text-muted-foreground' : margin < 0 ? 'text-[var(--stop)]' : margin < 10 ? 'text-[var(--warn)]' : 'text-[var(--done)]'}`}
          >
            {margin == null ? '—' : `${margin.toFixed(1)}%`}
          </td>
        )}
        <td className={`${TD} px-1`}>
          <input
            data-r={i}
            data-c="note"
            className={CELL}
            value={l.note}
            maxLength={500}
            placeholder="—"
            onChange={(e) => d.setLine(l.key, { note: e.target.value })}
            onKeyDown={(e) => gridKey(e, i, 'note')}
            aria-label="Ghi chú dòng"
          />
        </td>
        <td className={`${TD} px-1 text-center whitespace-nowrap`}>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-1 text-xs"
            onClick={() => d.toggleOpen(l.key)}
            aria-expanded={open}
            title="Quy cách · giá gợi ý · điền spec"
          >
            {open ? '▴' : '▾'}
          </button>
          <button
            type="button"
            className="text-muted-foreground px-1 hover:text-[var(--stop)]"
            onClick={() => d.removeLine(l.key)}
            aria-label="Bỏ dòng"
            title="Bỏ dòng"
          >
            <Trash2 className="inline size-3.5" strokeWidth={1.8} />
          </button>
        </td>
      </tr>
      {open && (
        <QuoteLineDetails
          colCount={cols - 1}
          product={p}
          specs={specs}
          mine={mine}
          market={market}
          onSaved={(x) => d.replaceProduct(l.key, x)}
        />
      )}
    </Fragment>
  )
}

/* ── Thanh chốt đáy ────────────────────────────────────────────────────── */
function CommitBar({ d, back }: { d: BaoGiaFormCtx; back: string }) {
  const edit = d.mode === 'edit'
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
        {d.canSeeCost && d.tong.below > 0 && (
          <Nhan tone="stop">{d.tong.below} dòng dưới giá thành</Nhan>
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
