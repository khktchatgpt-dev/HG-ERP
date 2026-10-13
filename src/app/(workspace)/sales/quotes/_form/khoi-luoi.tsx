'use client'

import { Fragment, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { Plus, Search, Trash2 } from 'lucide-react'
import { ProductSearchDialog } from '@/components/sales/ProductSearchDialog'
import { QuickAddProduct } from '@/components/sales/QuickAddProduct'
import { hasNoSpec } from '@/components/sales/ProductSpecFill'
import {
  BOM_LABEL,
  dimStr,
  inchStr,
  QuoteLineDetails,
} from '@/components/sales/quote-form.shared'
import { PRICE_NAME, type PlanPrice } from '@/lib/sale-price'
import {
  EDGE,
  GhiChuNoiBo,
  GIA_TIP,
  INT,
  INT_HEAD,
  NHOM,
  NhomTh,
  fmtPct,
  useAnGiaNoiBo,
} from '../../_erp/gia-noi-bo'
import { BTN_SUB, CELL, fmtMoney, num } from '../../orders/_form/don-form.shared'
import type { BaoGiaFormCtx, LineRow } from './useBaoGiaForm'

/**
 * LƯỚI DÒNG của form báo giá (khuôn F) — tách khỏi BaoGiaForm 13/10/2026 khi
 * dựng artboard bước 2 "giá nội bộ / giá gửi khách":
 *
 *   # · Sản phẩm · SL │ GỬI KHÁCH: Giá trước CK · CK% · Giá chào · Thành tiền
 *                     │ NỘI BỘ:    Giá vốn KH · Giá bán KH · ± Bán KH · Lãi thực
 *
 * Nhóm nội bộ đứng bên PHẢI (Q1): che đi thì phần trái là tờ in. Mã khách, ĐVT
 * xuống dòng 2 của ô SP và ghi chú dòng vào ngăn ▾ để 1.053px (1280 trừ sidebar)
 * còn chỗ cho tên SP khi đủ 4 cột nội bộ.
 */

const TH =
  'h-7 border-b border-border bg-muted px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase'
const TD = 'h-[40px] border-b border-border px-1.5 align-middle text-[13px]'
const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'

type Col = 'sp' | 'qty' | 'price' | 'ck'
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

/** Đưa ô giá của một dòng ra giữa khung và đặt con trỏ vào đó. */
export function goPrice(key: number | null) {
  if (key == null) return
  const el = document.getElementById(`cell-${key}-price`)
  el?.scrollIntoView({ block: 'center' })
  el?.focus()
}

function planTitle(plan: PlanPrice | null, currency: string) {
  if (!plan) return `SP chưa có ${PRICE_NAME.plan}`
  if (plan.currency !== currency)
    return `Giá kế hoạch tính bằng ${plan.currency}, báo giá bằng ${currency} — không so lãi`
  return plan.cost == null
    ? `SP mới có ${PRICE_NAME.plan} ${fmtMoney(plan.price)}, chưa bóc giá vốn`
    : `${PRICE_NAME.cost} ${fmtMoney(plan.cost)} · ${PRICE_NAME.plan} ${fmtMoney(plan.price)}`
}

export function KhoiLuoiBaoGia({ d }: { d: BaoGiaFormCtx }) {
  const an = useAnGiaNoiBo()
  const cost = d.canSeeCost && !an.hidden
  const cols = 9 + (cost ? 4 : 0)
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
          <button
            type="button"
            className="text-xs text-[var(--stop)] underline underline-offset-2"
            onClick={() => goPrice(d.tong.firstBelow)}
          >
            {d.tong.below} dòng dưới {PRICE_NAME.cost} (bán lỗ)
          </button>
        )}
        {cost && d.tong.belowPlan > 0 && (
          <button
            type="button"
            className="text-xs text-[var(--warn)] underline underline-offset-2"
            onClick={() => goPrice(d.tong.firstBelowPlan)}
          >
            {d.tong.belowPlan} dòng thấp hơn {PRICE_NAME.plan}
          </button>
        )}
        <GhiChuNoiBo
          canSee={d.canSeeCost}
          hidden={an.hidden}
          cols={4}
          onShow={an.toggle}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col />
            <col className="w-[72px]" />
            <col className="w-[116px]" />
            <col className="w-[52px]" />
            <col className="w-[92px]" />
            <col className="w-[100px]" />
            {cost && (
              <>
                <col className="w-[92px]" />
                <col className="w-[92px]" />
                <col className="w-[80px]" />
                <col className="w-[76px]" />
              </>
            )}
            <col className="w-[52px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <NhomTh kind="trong" colSpan={3} />
              <NhomTh kind="khach" colSpan={4}>
                {NHOM.quote}
              </NhomTh>
              {cost && (
                <NhomTh kind="noi-bo" colSpan={4}>
                  {NHOM.int}
                </NhomTh>
              )}
              <NhomTh kind="trong" colSpan={1} />
            </tr>
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Sản phẩm · mã khách</th>
              <th className={`${TH} text-right`}>SL/MOQ</th>
              <th className={`${TH} text-right`}>Giá trước CK *</th>
              <th className={`${TH} text-right`}>CK%</th>
              <th className={`${TH} text-right`}>{PRICE_NAME.quote}</th>
              <th className={`${TH} text-right`}>Thành tiền</th>
              {cost && (
                <>
                  <th
                    className={`${TH} ${INT_HEAD} ${EDGE} text-right`}
                    title={GIA_TIP.cost}
                  >
                    {PRICE_NAME.cost}
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.plan}>
                    {PRICE_NAME.plan}
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.vs}>
                    ± Bán KH
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.lai}>
                    Lãi thực
                  </th>
                </>
              )}
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
              <Dong key={l.key} d={d} l={l} i={i} cols={cols} cost={cost} />
            ))}
          </tbody>
          {d.lines.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-muted text-[12px] font-medium">
                <td className="border-border h-8 border-t px-2" colSpan={2}>
                  <span className="text-muted-foreground">
                    Cộng {d.lines.length} dòng
                    {d.tong.withQty < d.lines.length &&
                      ` · ${d.lines.length - d.tong.withQty} chưa có SL`}
                  </span>
                </td>
                <td className={`border-border h-8 border-t px-1.5 ${NUM}`}>
                  {d.lines.reduce((s, l) => s + num(l.qty), 0).toLocaleString('en-US')}
                </td>
                <td className="border-border h-8 border-t" colSpan={3} />
                <td
                  className={`border-border h-8 border-t px-1.5 ${NUM}`}
                  title="Σ giá chào × SL — KHÔNG gồm dòng chưa có SL"
                >
                  {d.tong.ref > 0 ? fmtMoney(d.tong.ref) : '—'}
                </td>
                {cost && (
                  <>
                    <td
                      className={`border-border text-muted-foreground h-8 border-t px-1.5 font-normal ${INT_HEAD} ${EDGE}`}
                      colSpan={3}
                      title="Σ (giá chào − giá vốn KH) × SL, chỉ dòng có SL và có giá vốn cùng tiền tệ"
                    >
                      Σ lãi{' '}
                      <span
                        className={`font-mono ${d.tong.gain < 0 ? 'text-[var(--stop)]' : 'text-foreground'}`}
                      >
                        {fmtMoney(d.tong.gain)}
                      </span>{' '}
                      {d.h.currency}
                    </td>
                    <td
                      className={`border-border h-8 border-t px-1.5 ${NUM} ${INT_HEAD} ${d.tong.avgLai != null && d.tong.avgLai < 0 ? 'text-[var(--stop)]' : ''}`}
                      title={`Lãi thực bình quân, gia quyền theo trị giá — ${d.tong.withCost} dòng có ${PRICE_NAME.cost}; dòng thiếu SL tính 1`}
                    >
                      {fmtPct(d.tong.avgLai)}
                    </td>
                  </>
                )}
                <td className="border-border h-8 border-t" />
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
  cost,
}: {
  d: BaoGiaFormCtx
  l: LineRow
  i: number
  cols: number
  cost: boolean
}) {
  const p = l.productId ? d.known.get(l.productId) : undefined
  const pk = p?.packing ?? {}
  const { net, plan, check } = d.calc(l)
  const open = d.openKeys.has(l.key)
  const mine = l.productId ? d.lastPrices.get(l.productId) : undefined
  const market = l.productId ? d.marketPrices.get(l.productId) : undefined
  const noSpec = p ? hasNoSpec(p) : false
  const under = cost && check.below_cost
  const qty = num(l.qty)
  const flag = !cost
    ? ''
    : check.below_cost
      ? 'shadow-[inset_3px_0_0_var(--stop)]'
      : check.below_plan
        ? 'shadow-[inset_3px_0_0_var(--warn)]'
        : ''
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
  const mm = check.currency_mismatch
  return (
    <Fragment>
      <tr className="hover:bg-muted/40">
        <td
          className={`${TD} text-muted-foreground text-right font-mono text-xs ${flag}`}
        >
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
                  {p.customer_item_code && (
                    <span className="font-mono">· {p.customer_item_code}</span>
                  )}
                  {p.unit && <span>· {p.unit}</span>}
                  <span>· {BOM_LABEL[p.bom_status]}</span>
                  {noSpec && <span className="text-[var(--warn)]">thiếu quy cách</span>}
                  {l.note && !open && <span title={l.note}>· có ghi chú</span>}
                  {mine && (
                    <span>
                      · lần trước {mine.unit_price.toLocaleString('en-US')} (
                      {mine.quote_code})
                    </span>
                  )}
                  {!mine && market && (
                    <span>
                      · gần nhất {market.unit_price.toLocaleString('en-US')}{' '}
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
        <td className={`${TD} px-1`}>
          <input
            id={`cell-${l.key}-price`}
            data-r={i}
            data-c="price"
            className={`${CELL} ${NUM} ${(l.productId && l.unitPrice.trim() === '') || under ? 'border-[var(--stop)]' : ''}`}
            value={l.unitPrice}
            inputMode="decimal"
            onChange={(e) => d.setLine(l.key, { unitPrice: e.target.value })}
            onKeyDown={(e) => gridKey(e, i, 'price')}
            aria-label="Giá trước chiết khấu"
            title={
              under
                ? `Giá chào dưới ${PRICE_NAME.cost} ${fmtMoney(plan!.cost!)}`
                : undefined
            }
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
        <td className={`${TD} ${NUM} font-semibold ${under ? 'text-[var(--stop)]' : ''}`}>
          {net > 0 ? fmtMoney(net) : '—'}
        </td>
        <td className={`${TD} ${NUM} ${qty > 0 ? '' : 'text-muted-foreground'}`}>
          {net > 0 && qty > 0 ? fmtMoney(net * qty) : '—'}
        </td>
        {cost && (
          <>
            <td
              className={`${TD} ${NUM} ${INT} ${EDGE} text-muted-foreground`}
              title={planTitle(plan, d.h.currency)}
            >
              {plan?.cost != null
                ? `${fmtMoney(plan.cost)}${mm ? ` ${plan.currency}` : ''}`
                : plan
                  ? 'chưa bóc'
                  : '—'}
            </td>
            <td className={`${TD} ${NUM} ${INT} text-muted-foreground`}>
              {plan ? (
                `${fmtMoney(plan.price)}${mm ? ` ${plan.currency}` : ''}`
              ) : l.productId ? (
                // Mở tab mới: không mất báo giá đang soạn.
                <Link
                  href="/sales/gia-thanh"
                  target="_blank"
                  className="font-sans text-[var(--primary)] underline underline-offset-2"
                  title={`SP chưa có ${PRICE_NAME.plan} — mở màn Tính giá SP`}
                >
                  Tính giá
                </Link>
              ) : (
                '—'
              )}
            </td>
            <td
              className={`${TD} ${NUM} ${INT} ${check.vs_plan_pct != null && check.vs_plan_pct < 0 ? 'text-[var(--warn)]' : 'text-muted-foreground'}`}
              title={mm ? planTitle(plan, d.h.currency) : GIA_TIP.vs}
            >
              {fmtPct(check.vs_plan_pct, true)}
            </td>
            <td
              className={`${TD} ${NUM} ${INT} ${check.lai_pct == null ? 'text-muted-foreground' : check.lai_pct < 0 ? 'text-[var(--stop)]' : ''}`}
              title={mm ? planTitle(plan, d.h.currency) : GIA_TIP.lai}
            >
              {fmtPct(check.lai_pct)}
            </td>
          </>
        )}
        <td className={`${TD} px-1 text-center whitespace-nowrap`}>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground px-1 text-xs"
            onClick={() => d.toggleOpen(l.key)}
            aria-expanded={open}
            title="Ghi chú dòng · quy cách · giá gợi ý"
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
        <>
          <tr className="bg-muted/30">
            <td />
            <td colSpan={cols - 1} className="px-2 pt-2">
              <label className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-[88px] shrink-0 text-[10px] font-medium tracking-wide uppercase">
                  Ghi chú dòng
                </span>
                <input
                  className={`${CELL} max-w-[560px]`}
                  value={l.note}
                  maxLength={500}
                  placeholder="In lên báo giá ở cột Remark của dòng"
                  onChange={(e) => d.setLine(l.key, { note: e.target.value })}
                />
              </label>
            </td>
          </tr>
          <QuoteLineDetails
            colCount={cols - 1}
            product={p}
            specs={specs}
            mine={mine}
            market={market}
            onSaved={(x) => d.replaceProduct(l.key, x)}
          />
        </>
      )}
    </Fragment>
  )
}
