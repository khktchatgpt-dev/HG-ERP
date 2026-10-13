'use client'

import { useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { ClipboardPaste, PackagePlus, Plus, Search, Trash2 } from 'lucide-react'
import { ProductSearchDialog } from '@/components/sales/ProductSearchDialog'
import { shipWeekLabel } from '@/lib/ship-week'
import { NUM, TD, TH } from '../../_erp/ui'
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
import { PRICE_NAME, suggestionNote } from '@/lib/sale-price'
import {
  BTN_SUB,
  CELL,
  INPUT,
  SPEC_FIELDS,
  fmtMoney,
  fmtN,
  num,
  type LineDraft,
  type LineRow,
} from './don-form.shared'
import type { DonHangFormCtx } from './useDonHangForm'

type Col = 'sp' | 'qty' | 'price' | 'ship' | 'note'

/**
 * Điều hướng kiểu bảng tính: Enter / ↓ xuống cùng cột, ↑ lên, Tab mặc định.
 * Ô đánh dấu bằng `data-r`/`data-c`; không cần ref từng ô.
 */
function gridKey(e: KeyboardEvent<HTMLElement>, r: number, c: Col) {
  if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  if ((e.target as HTMLElement).tagName === 'TEXTAREA' && e.key !== 'Enter') return
  const nr = e.key === 'ArrowUp' ? r - 1 : r + 1
  const el = document.querySelector<HTMLElement>(`[data-r="${nr}"][data-c="${c}"]`)
  if (el) {
    e.preventDefault()
    el.focus()
    if (el instanceof HTMLInputElement) el.select()
  }
}

/** Lưới dòng — nhân vật chính của màn. */
export function KhoiLuoiDong({ d }: { d: DonHangFormCtx }) {
  const [bulkDate, setBulkDate] = useState('')
  const an = useAnGiaNoiBo()
  /** Nhóm NỘI BỘ (± Bán KH · Lãi thực) — chỉ người thấy giá kế hoạch, và khi không bấm ẩn. */
  const cost = d.canSeeCost && !an.hidden
  const cols = 10 + (cost ? 2 : 0)
  const allSel = d.lines.length > 0 && d.selected.size === d.lines.length
  const cur = d.currency

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* thanh công cụ lưới */}
      <div className="border-border bg-card flex flex-wrap items-center gap-2 border-b px-6 py-1.5">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          Dòng hàng · {d.lines.length}
        </span>
        <span className="bg-border mx-1 h-4 w-px" />
        <button
          id="btn-pick"
          type="button"
          className={BTN_SUB}
          disabled={!d.linesEditable}
          onClick={() => {
            d.setReplaceKey(null)
            d.setPickOpen(true)
          }}
          title={d.linesEditable ? undefined : 'Chọn báo giá / khách trước'}
        >
          <Search className="size-3.5" strokeWidth={1.8} /> Chọn SP từ thư viện
        </button>
        <button
          type="button"
          className={BTN_SUB}
          disabled={!d.linesEditable}
          onClick={() => d.setPasteOpen(!d.pasteOpen)}
        >
          <ClipboardPaste className="size-3.5" strokeWidth={1.8} /> Dán từ Excel
        </button>
        <button
          type="button"
          className={BTN_SUB}
          disabled={!d.linesEditable}
          onClick={() => d.setDraftOpen(!d.draftOpen)}
        >
          <PackagePlus className="size-3.5" strokeWidth={1.8} /> SP mới chưa có mã
        </button>
        <span className="flex-1" />
        {d.selected.size > 0 && (
          <>
            <span className="text-muted-foreground text-xs">
              Đã tick {d.selected.size}:
            </span>
            <button type="button" className={BTN_SUB} onClick={d.removeSelected}>
              <Trash2 className="size-3.5" strokeWidth={1.8} /> Bỏ dòng
            </button>
          </>
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
          cols={2}
          onShow={an.toggle}
        />
        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
          Tuần giao
          <input
            type="date"
            className={`${INPUT} h-7 w-[140px]`}
            value={bulkDate}
            onChange={(e) => setBulkDate(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={BTN_SUB}
          disabled={!bulkDate || d.lines.length === 0}
          onClick={() => d.applyShipDate(bulkDate)}
          title={
            d.selected.size ? 'Áp cho các dòng đang tick' : 'Áp cho các dòng chưa có ngày'
          }
        >
          Áp cho {d.selected.size ? `${d.selected.size} dòng tick` : 'dòng trống'}
        </button>
      </div>

      {d.pasteOpen && <KhoiDan d={d} />}
      {d.draftOpen && <KhoiSpMoi d={d} />}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          {/* Mã khách + ĐVT xuống dòng 2 của ô SP (13/10/2026) để chỗ cho nhóm nội bộ
              mà tên SP không bị bóp ở 1.053px (1280 trừ sidebar). */}
          <colgroup>
            <col className="w-8" />
            <col className="w-9" />
            <col />
            <col className="w-[80px]" />
            <col className="w-[120px]" />
            <col className="w-[100px]" />
            {cost && (
              <>
                <col className="w-[80px]" />
                <col className="w-[76px]" />
              </>
            )}
            <col className="w-[140px]" />
            <col className="w-[130px]" />
            <col className="w-8" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <NhomTh kind="trong" colSpan={4} />
              <NhomTh kind="khach" colSpan={2}>
                {NHOM.order}
              </NhomTh>
              {cost && (
                <NhomTh kind="noi-bo" colSpan={2}>
                  {NHOM.int}
                </NhomTh>
              )}
              <NhomTh kind="trong" colSpan={3} />
            </tr>
            <tr>
              <th className={`${TH} px-2`}>
                <input
                  type="checkbox"
                  checked={allSel}
                  onChange={(e) => d.selectAll(e.target.checked)}
                />
              </th>
              <th className={`${TH} px-2 text-right`}>#</th>
              <th className={TH}>Sản phẩm · mã khách</th>
              <th className={`${TH} text-right`}>SL *</th>
              <th className={`${TH} text-right`}>Đơn giá * ({cur})</th>
              <th className={`${TH} text-right`}>Thành tiền</th>
              {cost && (
                <>
                  <th
                    className={`${TH} ${INT_HEAD} ${EDGE} text-right`}
                    title={GIA_TIP.vs}
                  >
                    ± Bán KH
                  </th>
                  <th className={`${TH} ${INT_HEAD} text-right`} title={GIA_TIP.lai}>
                    Lãi thực
                  </th>
                </>
              )}
              <th className={TH}>Tuần giao</th>
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
                  {d.linesEditable
                    ? 'Chưa có dòng nào. Chọn SP từ thư viện, dán cột từ Excel (mã · SL · giá · tuần), hoặc khai SP mới.'
                    : d.source === 'quote'
                      ? 'Chọn báo giá ở trên — dòng sẽ tự đổ xuống theo giá đã chốt.'
                      : 'Chọn khách hàng trước.'}
                </td>
              </tr>
            )}
            {d.lines.map((l, i) => (
              <Dong key={l.key} d={d} l={l} i={i} cost={cost} />
            ))}
          </tbody>
          {d.lines.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-muted font-medium">
                <td className={`${TD} border-t`} colSpan={3}>
                  <span className="text-muted-foreground text-xs">
                    Tổng {d.lines.length} dòng
                    {d.tong.zero > 0 && ` · ${d.tong.zero} dòng giá 0`}
                    {d.tong.noDate > 0 && ` · ${d.tong.noDate} dòng chưa có tuần giao`}
                    {d.tong.late > 0 && (
                      <span className="text-[var(--warn)]">
                        {' '}
                        · {d.tong.late} dòng giao sau hạn đơn
                      </span>
                    )}
                  </span>
                </td>
                <td className={`${TD} ${NUM} border-t`}>{fmtN(d.tong.qty)}</td>
                <td className={`${TD} border-t`} />
                <td className={`${TD} ${NUM} border-t`}>{fmtMoney(d.tong.value)}</td>
                {cost && (
                  <td className={`${TD} ${INT_HEAD} ${EDGE} border-t`} colSpan={2} />
                )}
                <td className={`${TD} border-t`} colSpan={3}>
                  <span className="text-muted-foreground text-xs">
                    Chưa gồm thuế / phí — giá theo đơn giá dòng
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <ProductSearchDialog
        open={d.pickOpen}
        onOpenChange={d.setPickOpen}
        customerId={d.activeCustomerId || null}
        usedIds={new Set()}
        multi={d.replaceKey == null}
        title={
          d.replaceKey == null
            ? 'Chọn sản phẩm (mỗi SP một dòng)'
            : 'Đổi sản phẩm của dòng'
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

/** Đưa ô giá của một dòng ra giữa khung và đặt con trỏ vào đó. */
function goPrice(key: number | null) {
  if (key == null) return
  const el = document.getElementById(`cell-${key}-price`)
  el?.scrollIntoView({ block: 'center' })
  el?.focus()
}

function Dong({
  d,
  l,
  i,
  cost,
}: {
  d: DonHangFormCtx
  l: LineRow
  i: number
  cost: boolean
}) {
  const p = l.productId ? d.known.get(l.productId) : undefined
  const { check } = d.calc(l)
  const under = cost && check.below_cost
  const itemCode = p?.customer_item_code ?? l.draft?.itemCode ?? ''
  const unit = p?.unit ?? l.draft?.unit ?? ''
  const flag = !cost
    ? ''
    : check.below_cost
      ? 'shadow-[inset_3px_0_0_var(--stop)]'
      : check.below_plan
        ? 'shadow-[inset_3px_0_0_var(--warn)]'
        : ''
  const locked = l.shipped > 0
  const qtyBad = !(num(l.qty) > 0) || num(l.qty) < l.shipped
  const week = l.shipDate ? shipWeekLabel(l.shipDate) : null
  const late = !!d.h.due_date && !!l.shipDate && l.shipDate > d.h.due_date
  const ro = !d.linesEditable
  return (
    <tr
      className={`group ${d.selected.has(l.key) ? 'bg-[var(--accent)]/40' : 'hover:bg-muted/40'}`}
    >
      <td className={`${TD} px-2`}>
        <input
          type="checkbox"
          checked={d.selected.has(l.key)}
          onChange={(e) => d.toggleSel(l.key, e.target.checked)}
        />
      </td>
      <td
        className={`${TD} text-muted-foreground px-2 text-right font-mono text-xs ${flag}`}
      >
        {i + 1}
      </td>
      <td className={`${TD} py-1`}>
        {p ? (
          <button
            id={`cell-${l.key}-sp`}
            type="button"
            data-r={i}
            data-c="sp"
            onKeyDown={(e) => gridKey(e, i, 'sp')}
            className="flex w-full flex-col text-left"
            disabled={ro || locked}
            onClick={() => {
              d.setReplaceKey(l.key)
              d.setPickOpen(true)
            }}
            title={locked ? `Đã xuất ${l.shipped} — không đổi SP` : 'Bấm để đổi SP'}
          >
            <span className="font-mono text-[13px] leading-4 font-medium">{p.code}</span>
            <span
              className="text-muted-foreground truncate text-[11px] leading-4"
              title={p.name}
            >
              {p.name}
              {itemCode && <span className="font-mono"> · {itemCode}</span>}
              {unit && ` · ${unit}`}
            </span>
          </button>
        ) : l.draft ? (
          <div className="flex flex-col">
            <span className="font-mono text-[13px] leading-4 font-medium">
              {l.draft.code}{' '}
              <span className="text-[11px] font-normal text-[var(--warn)]">
                SP mới — tạo khi lưu
              </span>
            </span>
            <span className="text-muted-foreground truncate text-[11px] leading-4">
              {l.draft.name}
              {itemCode && <span className="font-mono"> · {itemCode}</span>}
              {unit && ` · ${unit}`}
            </span>
          </div>
        ) : (
          <button
            id={`cell-${l.key}-sp`}
            type="button"
            data-r={i}
            data-c="sp"
            onKeyDown={(e) => gridKey(e, i, 'sp')}
            className="flex w-full flex-col text-left text-[13px] leading-4 text-[var(--stop)]"
            onClick={() => {
              d.setReplaceKey(l.key)
              d.setPickOpen(true)
            }}
          >
            {l.pastedCode ? (
              <>
                <span className="font-mono">{l.pastedCode}</span>
                <span className="text-[11px]">không khớp mã nào — bấm để chọn SP</span>
              </>
            ) : (
              'Chưa chọn SP — bấm để chọn'
            )}
          </button>
        )}
      </td>
      <td className={`${TD} px-1`}>
        <input
          id={`cell-${l.key}-qty`}
          data-r={i}
          data-c="qty"
          className={cn(CELL, `${NUM} ${qtyBad ? 'border-[var(--stop)]' : ''}`)}
          value={l.qty}
          inputMode="numeric"
          disabled={ro}
          onChange={(e) => d.setLine(l.key, { qty: e.target.value })}
          onKeyDown={(e) => gridKey(e, i, 'qty')}
          title={locked ? `Đã xuất ${l.shipped} — không dưới số này` : undefined}
        />
      </td>
      <td className={`${TD} px-1`}>
        <div className="flex flex-col">
          <input
            id={`cell-${l.key}-price`}
            data-r={i}
            data-c="price"
            className={cn(
              CELL,
              `${NUM} ${l.priceFrom ? 'h-6' : ''} ${l.unitPrice.trim() === '' || under ? 'border-[var(--stop)]' : ''}`,
            )}
            value={l.unitPrice}
            inputMode="decimal"
            disabled={ro}
            // Gõ tay là xoá cờ "giá gợi ý".
            onChange={(e) =>
              d.setLine(l.key, {
                unitPrice: e.target.value,
                priceFrom: undefined,
                priceRef: null,
              })
            }
            onKeyDown={(e) => gridKey(e, i, 'price')}
            aria-label={`Đơn giá dòng ${i + 1}`}
            title={under ? `Dưới ${PRICE_NAME.cost} — bán lỗ` : undefined}
          />
          {l.priceFrom && (
            <span
              className="text-muted-foreground truncate px-1.5 text-right text-[11px] leading-4"
              title="Giá gợi ý — soát lại trước khi lưu"
            >
              {suggestionNote({ from: l.priceFrom, ref: l.priceRef ?? null })}
            </span>
          )}
        </div>
      </td>
      <td className={`${TD} ${NUM}`}>{fmtMoney(num(l.qty) * num(l.unitPrice))}</td>
      {cost && (
        <>
          <td
            className={`${TD} ${NUM} ${INT} ${EDGE} ${check.vs_plan_pct != null && check.vs_plan_pct < 0 ? 'text-[var(--warn)]' : 'text-muted-foreground'}`}
          >
            {fmtPct(check.vs_plan_pct, true)}
          </td>
          <td
            className={`${TD} ${NUM} ${INT} ${check.lai_pct == null ? 'text-muted-foreground' : check.lai_pct < 0 ? 'text-[var(--stop)]' : ''}`}
          >
            {fmtPct(check.lai_pct)}
          </td>
        </>
      )}
      <td className={`${TD} px-1`}>
        <div className="flex flex-col">
          <input
            data-r={i}
            data-c="ship"
            type="date"
            className={cn(CELL, `h-6 ${late ? 'border-[var(--warn)]' : ''}`)}
            value={l.shipDate}
            disabled={ro}
            onChange={(e) => d.setLine(l.key, { shipDate: e.target.value })}
            onKeyDown={(e) => gridKey(e, i, 'ship')}
          />
          <span
            className={`px-1.5 font-mono text-[11px] leading-4 ${late ? 'text-[var(--warn)]' : 'text-muted-foreground'}`}
          >
            {week ? `tuần ${week}` : late ? 'sau hạn đơn' : ''}
            {week && late ? ' · sau hạn đơn' : ''}
          </span>
        </div>
      </td>
      <td className={`${TD} px-1`}>
        <input
          data-r={i}
          data-c="note"
          className={CELL}
          value={l.note}
          disabled={ro}
          onChange={(e) => d.setLine(l.key, { note: e.target.value })}
          onKeyDown={(e) => gridKey(e, i, 'note')}
          placeholder="—"
        />
      </td>
      <td className={`${TD} px-1 text-center`}>
        {!locked && !ro && (
          <button
            type="button"
            className="text-muted-foreground hover:text-[var(--stop)]"
            onClick={() => d.removeLine(l.key)}
            aria-label="Bỏ dòng"
            title="Bỏ dòng"
          >
            <Trash2 className="size-3.5" strokeWidth={1.8} />
          </button>
        )}
        {locked && (
          <span
            className="text-muted-foreground font-mono text-[11px]"
            title="Đã xuất — không bỏ được"
          >
            ×{l.shipped}
          </span>
        )}
      </td>
    </tr>
  )
}

/** Ngăn dán: bôi cột từ sổ order (ART.No · QUANTITY · SHIPMENT …) rồi dán. */
function KhoiDan({ d }: { d: DonHangFormCtx }) {
  const r = d.pasteReport
  return (
    <div className="border-border bg-muted/40 border-b px-6 py-2">
      <div className="flex items-start gap-3">
        <textarea
          className={`${INPUT} h-24 flex-1 resize-y font-mono text-xs`}
          placeholder={
            'Dán từ Excel — mỗi dòng: mã SP (HG hoặc mã khách) · SL · đơn giá · tuần giao (w37.26 hay 20/11/2026)\nCó dòng tiêu đề (ART.No, QUANTITY, SHIPMENT…) càng tốt; không có thì tự đoán theo cột.'
          }
          value={d.pasteText}
          onChange={(e) => d.setPasteText(e.target.value)}
          autoFocus
        />
        <div className="flex w-[200px] flex-col gap-1.5">
          <button
            type="button"
            className={`${BTN_SUB} justify-center bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90`}
            disabled={d.pasteBusy || !d.pasteText.trim()}
            onClick={d.applyPaste}
          >
            {d.pasteBusy ? 'Đang tra mã…' : 'Thêm vào lưới'}
          </button>
          <button
            type="button"
            className={`${BTN_SUB} justify-center`}
            onClick={() => d.setPasteOpen(false)}
          >
            Đóng
          </button>
          {r && (
            <div className="text-xs leading-5">
              <div className="text-[var(--done)]">Đã thêm {r.ok} dòng khớp mã</div>
              {r.unmatched.length > 0 && (
                <div className="text-[var(--stop)]">
                  {r.unmatched.length} mã không khớp: {r.unmatched.slice(0, 5).join(', ')}
                  {r.unmatched.length > 5 && '…'} — đã thêm dòng, chọn SP tại chỗ
                </div>
              )}
              {r.errors.map((e) => (
                <div key={e} className="text-[var(--warn)]">
                  {e}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** SP mới chưa có trong thư viện — khai ở đây, tạo vào Kỹ thuật khi LƯU đơn. */
function KhoiSpMoi({ d }: { d: DonHangFormCtx }) {
  const [f, setF] = useState<LineDraft & { price: string }>({
    code: '',
    name: '',
    unit: 'cái',
    itemCode: '',
    notes: '',
    barcode: '',
    image: null,
    spec: d.emptySpec(),
    price: '',
  })
  const up = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const ok = f.code.trim() && f.name.trim()
  return (
    <div className="border-border bg-muted/40 border-b px-6 py-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <L label="Mã HG *" w="w-[130px]">
          <input
            className={`${INPUT} font-mono`}
            value={f.code}
            onChange={(e) => up('code', e.target.value)}
            autoFocus
          />
        </L>
        <L label="Tên SP *" w="w-[240px]">
          <input
            className={INPUT}
            value={f.name}
            onChange={(e) => up('name', e.target.value)}
          />
        </L>
        <L label="ĐVT" w="w-[70px]">
          <input
            className={INPUT}
            value={f.unit}
            onChange={(e) => up('unit', e.target.value)}
          />
        </L>
        <L label="Mã khách" w="w-[120px]">
          <input
            className={`${INPUT} font-mono`}
            value={f.itemCode}
            onChange={(e) => up('itemCode', e.target.value)}
          />
        </L>
        <L label={`Giá (${d.currency})`} w="w-[90px]">
          <input
            className={`${INPUT} ${NUM}`}
            value={f.price}
            onChange={(e) => up('price', e.target.value)}
          />
        </L>
        <L label="Barcode" w="w-[130px]">
          <input
            className={`${INPUT} font-mono`}
            value={f.barcode}
            onChange={(e) => up('barcode', e.target.value)}
          />
        </L>
        {SPEC_FIELDS.map(([k, label, ph]) => (
          <L key={k} label={label} w="w-[150px]">
            <input
              className={INPUT}
              value={f.spec[k]}
              placeholder={ph}
              onChange={(e) =>
                setF((x) => ({ ...x, spec: { ...x.spec, [k]: e.target.value } }))
              }
            />
          </L>
        ))}
        <L label="Ghi chú SP" w="w-[200px]">
          <input
            className={INPUT}
            value={f.notes}
            onChange={(e) => up('notes', e.target.value)}
          />
        </L>
        <L label="Ảnh" w="w-[200px]">
          <input
            type="file"
            accept="image/*"
            className="text-xs"
            onChange={(e) => setF((x) => ({ ...x, image: e.target.files?.[0] ?? null }))}
          />
        </L>
        <button
          type="button"
          className={`${BTN_SUB} bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90`}
          disabled={!ok}
          onClick={() => {
            const { price, ...draft } = f
            d.addDraft(
              {
                ...draft,
                code: draft.code.trim(),
                name: draft.name.trim(),
                unit: draft.unit.trim() || 'cái',
                itemCode: draft.itemCode.trim(),
              },
              price.trim(),
            )
            setF((x) => ({
              ...x,
              code: '',
              name: '',
              itemCode: '',
              price: '',
              barcode: '',
              notes: '',
              image: null,
              spec: d.emptySpec(),
            }))
          }}
        >
          <Plus className="size-3.5" strokeWidth={1.8} /> Thêm dòng SP mới
        </button>
        <button type="button" className={BTN_SUB} onClick={() => d.setDraftOpen(false)}>
          Đóng
        </button>
      </div>
      <p className="text-muted-foreground mt-1 text-[11px]">
        SP mới được tạo vào thư viện Kỹ thuật đúng lúc lưu đơn (gắn khách của đơn) — không
        tạo trước để tránh mã mồ côi.
      </p>
    </div>
  )
}

function L({
  label,
  w,
  children,
}: {
  label: string
  w: string
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${w}`}>
      <span className="text-muted-foreground text-[11px] leading-4">{label}</span>
      {children}
    </label>
  )
}
