'use client'

import Link from 'next/link'
import type { KeyboardEvent } from 'react'
import { ClipboardPaste, Lock, Save, Target, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import type { PricingBoard, PricingLine } from '@/modules/dept/sales/orders.service'
import {
  Chon,
  CountCell,
  CountStrip,
  ErpHeader,
  ErpPage,
  ErpStatusBar,
  FilterRow,
  Nhan,
  Seg,
  ToolBtn,
} from '../../_erp/ui'
import { BTN_PRI, BTN_SUB, CELL, INPUT } from '../_form/don-form.shared'
import { parsePrice, useDienGia, type DienGiaCtx } from './useDienGia'

const TH =
  'h-7 border-b border-border bg-muted px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase'
const TD = 'h-[44px] border-b border-border px-2 align-middle text-[13px]'
const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'
const SUB = 'text-muted-foreground block truncate text-[11px] leading-4'

/** Số tiền theo tiền tệ của ĐƠN — USD và VND không bao giờ cộng chung. */
const money = (v: number, cur: string) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 }).format(
    v,
  )

/** Enter / ↓ xuống ô giá dòng dưới, ↑ lên — bảng tính. */
function gridKey(e: KeyboardEvent<HTMLInputElement>, r: number) {
  if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const el = document.querySelector<HTMLInputElement>(
    `[data-r="${e.key === 'ArrowUp' ? r - 1 : r + 1}"]`,
  )
  if (el) {
    e.preventDefault()
    el.focus()
    el.select()
  }
}

/**
 * ĐIỀN ĐƠN GIÁ — khuôn F (Bảng nhập liệu, kiểu ERP — 07/10/2026). Mọi dòng đơn
 * còn sống trên một lưới: gõ giá (Enter xuống dòng), mồi FOB kế hoạch, dán từ
 * Excel vào ngăn tại chỗ có xem trước — rồi Lưu MỘT lần. Dòng chưa có giá làm
 * doanh số, giá trị đơn và bảng tin Giám đốc ra 0.
 */
export function DienGiaScreen({ board }: { board: PricingBoard }) {
  const d = useDienGia(board)
  const s = board.stats
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          { label: 'Điền đơn giá' },
        ]}
        title="Điền đơn giá"
        sub="Gõ giá cho từng dòng rồi lưu một lần — dán từ Excel hay mồi FOB kế hoạch đều chỉ điền vào ô, bạn soát rồi mới lưu."
        actions={
          <>
            {d.hasPlanColumn && (
              <ToolBtn onClick={d.fillFromPlan} icon={Target}>
                Lấy FOB kế hoạch ({d.planFillable.length})
              </ToolBtn>
            )}
            <ToolBtn onClick={() => d.setPasteOpen(!d.pasteOpen)} icon={ClipboardPaste}>
              Dán từ Excel
            </ToolBtn>
            <ToolBtn onClick={d.save} icon={Save} primary>
              Lưu {d.dirty.length} dòng
            </ToolBtn>
          </>
        }
      />

      <CountStrip>
        <CountCell
          label="Dòng thiếu giá"
          value={String(s.unpriced)}
          sub={`trên ${s.lines_total} dòng đơn còn sống`}
          tone={s.unpriced ? 'stop' : 'done'}
          on={d.onlyUnpriced}
          onClick={() => d.setOnlyUnpriced(true)}
        />
        <CountCell
          label="Bạn sửa được"
          value={String(s.unpriced_mine)}
          sub="đơn bạn tạo (hoặc bạn là quản lý)"
          tone={s.unpriced_mine ? 'warn' : 'neutral'}
        />
        <CountCell
          label="Đơn thiếu giá"
          value={String(s.orders_unpriced)}
          sub={`trên ${s.orders_total} đơn còn sống`}
        />
        {d.hasPlanColumn && (
          <CountCell
            label="Mồi được FOB KH"
            value={String(d.planFillable.length)}
            sub="dòng trống có FOB cùng tiền tệ"
            onClick={d.fillFromPlan}
          />
        )}
        <CountCell
          label="Đang sửa"
          value={String(d.dirty.length)}
          sub={d.dirty.length ? 'chưa lưu' : 'chưa gõ gì'}
          tone={d.dirty.length ? 'neutral' : 'neutral'}
        />
      </CountStrip>

      <FilterRow>
        <Seg
          label="Hiện"
          value={d.onlyUnpriced ? 'unpriced' : 'all'}
          onChange={(v) => d.setOnlyUnpriced(v === 'unpriced')}
          options={[
            { value: 'unpriced', label: 'Thiếu giá', count: s.unpriced },
            { value: 'all', label: 'Mọi dòng', count: s.lines_total },
          ]}
        />
        <Chon
          label="Khách"
          value={d.customer}
          onChange={d.setCustomer}
          options={[
            { value: 'all', label: 'Mọi khách' },
            ...d.customers.map(([name, n]) => ({ value: name, label: `${name} (${n})` })),
          ]}
          width={200}
        />
        <Chon
          label="Đơn"
          value={d.order}
          onChange={d.setOrder}
          options={[
            { value: 'all', label: 'Mọi đơn' },
            ...d.orders.map(([id, o]) => ({
              value: id,
              label: `${o.code}${o.unpriced ? ` · thiếu ${o.unpriced}` : ''}`,
            })),
          ]}
          width={220}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tìm
          <input
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="mã đơn · mã SP · mã khách · tên"
            className={`${INPUT} w-[240px]`}
          />
        </label>
      </FilterRow>

      {d.pasteOpen && <KhoiDan d={d} />}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col className="w-[170px]" />
            <col />
            <col className="w-[84px]" />
            {d.hasPlanColumn && <col className="w-[120px]" />}
            <col className="w-[150px]" />
            {d.hasPlanColumn && <col className="w-[64px]" />}
            <col className="w-[120px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Đơn · khách</th>
              <th className={TH}>Sản phẩm · mã khách</th>
              <th className={`${TH} text-right`}>SL</th>
              {d.hasPlanColumn && <th className={`${TH} text-right`}>FOB kế hoạch</th>}
              <th className={`${TH} text-right`}>Đơn giá</th>
              {d.hasPlanColumn && <th className={`${TH} text-right`}>± FOB</th>}
              <th className={`${TH} text-right`}>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.length === 0 && (
              <tr>
                <td
                  colSpan={d.hasPlanColumn ? 8 : 6}
                  className="text-muted-foreground px-6 py-10 text-center text-[13px]"
                >
                  {d.onlyUnpriced
                    ? 'Không còn dòng nào thiếu giá trong phạm vi lọc — chuyển "Mọi dòng" để sửa giá đã có.'
                    : 'Không có dòng nào khớp bộ lọc.'}
                </td>
              </tr>
            )}
            {d.rows.map((l, i) => (
              <Dong key={l.line_id} d={d} l={l} i={i} />
            ))}
          </tbody>
          {d.rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-muted text-[12px] font-medium">
                <td
                  className="border-border h-8 border-t px-2"
                  colSpan={d.hasPlanColumn ? 5 : 4}
                >
                  <span className="text-muted-foreground">
                    {d.rows.length} dòng đang hiện · {d.dirty.length} dòng sẽ lưu
                    {d.belowPlan > 0 && (
                      <span className="text-[var(--warn)]">
                        {' '}
                        · {d.belowPlan} dòng gõ thấp hơn FOB KH
                      </span>
                    )}
                  </span>
                </td>
                <td
                  className="border-border h-8 border-t"
                  colSpan={d.hasPlanColumn ? 2 : 1}
                />
                <td className={`border-border h-8 border-t px-2 ${NUM}`}>
                  {d.totalByCurrency.length
                    ? d.totalByCurrency
                        .map(([cur, v]) => `${money(v, cur)} ${cur}`)
                        .join(' · ')
                    : '—'}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Thanh chốt đáy: luôn hiện — nói rõ vì sao chưa lưu được. */}
      <div className="border-border bg-card sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t px-6 py-2">
        <span className="text-[13px]">
          <span className="font-mono font-semibold tabular-nums">{d.dirty.length}</span>
          <span className="text-muted-foreground"> dòng sẽ lưu</span>
          {d.totalByCurrency.length > 0 && (
            <span className="text-muted-foreground">
              {' '}
              ·{' '}
              {d.totalByCurrency.map(([cur, v]) => `${money(v, cur)} ${cur}`).join(' · ')}
            </span>
          )}
        </span>
        <span className="bg-border h-4 w-px" />
        {d.missing.length ? (
          <span className="flex flex-wrap items-center gap-x-2 text-[13px]">
            <span className="text-[var(--stop)]">Chưa lưu được:</span>
            {d.missing.map((m, i) => (
              <button
                key={i}
                type="button"
                className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
                onClick={() => {
                  if (!m.focus) return
                  const el = document.getElementById(m.focus)
                  el?.scrollIntoView({ block: 'center' })
                  el?.focus()
                }}
              >
                {m.msg}
              </button>
            ))}
          </span>
        ) : (
          <span className="text-[13px] text-[var(--done)]">
            Đủ điều kiện lưu
            {d.belowPlan > 0
              ? ` — ${d.belowPlan} dòng thấp hơn FOB KH, bạn đã soát?`
              : ''}
          </span>
        )}
        <input
          value={d.note}
          onChange={(e) => d.setNote(e.target.value)}
          placeholder="Lý do / nguồn giá (vào lịch sử đơn, không bắt buộc)"
          className={`${INPUT} min-w-[240px] flex-1`}
        />
        <button
          type="button"
          className={BTN_SUB}
          onClick={d.reset}
          disabled={d.busy || (!d.dirty.length && !d.invalidIds.length)}
        >
          <X className="size-3.5" strokeWidth={1.8} /> Bỏ thay đổi
        </button>
        <button
          type="button"
          className={BTN_PRI}
          disabled={d.busy || d.missing.length > 0}
          onClick={d.save}
        >
          <Save className="size-4" strokeWidth={1.8} />
          {d.busy ? 'Đang lưu…' : `Lưu ${d.dirty.length} dòng`}
        </button>
      </div>

      <ErpStatusBar
        left="Khoá = đơn của người khác (chỉ người tạo hoặc quản lý sửa giá) · đơn đã giao / huỷ không lên bảng này"
        right={
          <Link
            href="/sales/orders"
            className="hover:text-[var(--primary)] hover:underline"
          >
            ← Sổ đơn hàng
          </Link>
        }
      />
    </ErpPage>
  )
}

function Dong({ d, l, i }: { d: DienGiaCtx; l: PricingLine; i: number }) {
  const raw = d.draft[l.line_id]
  const typed = parsePrice(raw)
  const price = typed == null ? l.unit_price : typed
  const bad = Number.isNaN(typed)
  const changed = !bad && typed != null && typed !== l.unit_price
  const samePlan = l.plan_price != null && l.plan_currency === l.currency
  const diff =
    samePlan && Number.isFinite(price) && price > 0
      ? ((price - l.plan_price!) / l.plan_price!) * 100
      : null
  return (
    <tr
      className={`${changed ? 'bg-[var(--accent)]/40' : 'hover:bg-muted/40'} ${l.editable ? '' : 'text-muted-foreground'}`}
    >
      <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
      <td className={`${TD} min-w-0`}>
        <Link
          href={`/sales/orders/${l.order_id}`}
          className="block truncate font-mono text-xs text-[var(--primary)] hover:underline"
          title={l.order_code}
        >
          {l.order_code}
        </Link>
        <span className={SUB} title={l.customer_name}>
          {l.customer_name}
        </span>
      </td>
      <td className={`${TD} min-w-0`}>
        <span className="block truncate" title={l.product_name}>
          {l.product_name}
        </span>
        <span className={`${SUB} font-mono`}>
          {l.product_code}
          {l.customer_item_code ? (
            ` · KH ${l.customer_item_code}`
          ) : (
            <span className="text-[var(--warn)]"> · chưa có mã khách</span>
          )}
        </span>
      </td>
      <td className={`${TD} ${NUM}`}>
        {money(l.qty, 'VND')}
        <span className={`${SUB} text-right font-sans`}>{l.product_unit}</span>
      </td>
      {d.hasPlanColumn && (
        <td className={`${TD} ${NUM} text-muted-foreground`}>
          {l.plan_price != null ? (
            <>
              {money(l.plan_price, l.plan_currency ?? l.currency)}
              <span className={`${SUB} text-right font-sans`}>
                {l.plan_currency !== l.currency ? (
                  <span className="text-[var(--warn)]">{l.plan_currency} ≠ đơn</span>
                ) : l.editable &&
                  l.unit_price <= 0 &&
                  (raw === undefined || raw === '') ? (
                  <button
                    type="button"
                    className="text-[var(--primary)] hover:underline"
                    onClick={() =>
                      d.applyMany([{ line_id: l.line_id, price: l.plan_price! }])
                    }
                  >
                    lấy giá này
                  </button>
                ) : (
                  l.plan_currency
                )}
              </span>
            </>
          ) : (
            '—'
          )}
        </td>
      )}
      <td className={`${TD} px-1`}>
        <div className="flex items-center gap-1">
          {!l.editable && (
            <Lock
              className="text-muted-foreground size-3.5 shrink-0"
              aria-label="Đơn của người khác"
            />
          )}
          <input
            id={`cell-${l.line_id}`}
            data-r={i}
            inputMode="decimal"
            disabled={!l.editable || d.busy}
            value={raw ?? (l.unit_price > 0 ? String(l.unit_price) : '')}
            onChange={(e) => d.setCell(l.line_id, e.target.value)}
            onKeyDown={(e) => gridKey(e, i)}
            placeholder="0"
            className={`${CELL} ${NUM} ${bad ? 'border-[var(--stop)]' : changed ? 'border-[var(--primary)]' : l.editable && l.unit_price <= 0 ? 'border-[var(--warn)]/60' : ''}`}
            aria-label={`Đơn giá ${l.product_code} của đơn ${l.order_code}`}
            title={
              l.editable
                ? undefined
                : 'Đơn của người khác — chỉ người tạo hoặc quản lý sửa'
            }
          />
          <span className="text-muted-foreground w-8 shrink-0 text-xs">{l.currency}</span>
        </div>
      </td>
      {d.hasPlanColumn && (
        <td
          className={`${TD} ${NUM} text-xs ${diff == null ? 'text-muted-foreground' : diff < 0 ? 'text-[var(--warn)]' : 'text-[var(--done)]'}`}
        >
          {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${Math.round(diff * 10) / 10}%`}
        </td>
      )}
      <td className={`${TD} ${NUM} ${changed ? 'font-medium' : ''}`}>
        {Number.isFinite(price) && price > 0 ? (
          money(price * l.qty, l.currency)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  )
}

/** Ngăn dán từ Excel: dán → chọn dấu thập phân → XEM TRƯỚC → điền vào bảng (chưa lưu). */
function KhoiDan({ d }: { d: DienGiaCtx }) {
  const m = d.match
  return (
    <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[13px]">
            Bôi 2 cột <b>mã SP · đơn giá</b> (mã HG hoặc mã khách), hoặc 3 cột{' '}
            <b>mã đơn · mã SP · đơn giá</b> rồi dán. Giá chỉ điền vào ô — bạn soát rồi mới
            Lưu.
          </p>
          <textarea
            className={`${INPUT} h-24 resize-y font-mono text-xs`}
            value={d.pasteText}
            onChange={(e) => d.setPaste(e.target.value)}
            placeholder={'PT-138-155-HG\t12.5\nPT-138-156-HG\t8'}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted-foreground text-xs">Dấu thập phân</span>
            <Seg
              label=""
              value={d.sep}
              onChange={(v) => d.chooseSep(v)}
              options={[
                { value: '.', label: '1,234.56 (chấm)' },
                { value: ',', label: '1.234,56 (phẩy)' },
              ]}
            />
            <span className="flex-1" />
            <button
              type="button"
              className={BTN_SUB}
              onClick={() => d.setPasteOpen(false)}
            >
              Đóng
            </button>
            <button
              type="button"
              className={BTN_PRI}
              disabled={d.applicable.length === 0}
              onClick={d.applyPaste}
            >
              Điền {d.applicable.length} dòng vào bảng
            </button>
          </div>
        </div>
        {d.pasteText.trim() !== '' && (
          <div className="border-border bg-card max-h-56 w-[460px] shrink-0 overflow-auto rounded-sm border p-2 text-xs">
            <p className="mb-1">
              <b>{d.applicable.length}</b> dòng sẽ được điền
              {d.lockedCount > 0 && (
                <span className="text-muted-foreground">
                  {' '}
                  · {d.lockedCount} dòng khớp nhưng đơn của người khác
                </span>
              )}
            </p>
            {d.applicable.length > 0 && (
              <table className="w-full">
                <tbody>
                  {d.applicable.slice(0, 30).map((x) => {
                    const l = d.byId.get(x.line_id)!
                    return (
                      <tr key={x.line_id} className="border-border border-t">
                        <td className="py-0.5 pr-2 font-mono">{l.order_code}</td>
                        <td className="py-0.5 pr-2 font-mono">{l.product_code}</td>
                        <td className={`py-0.5 ${NUM}`}>
                          {money(l.unit_price, l.currency)} →{' '}
                          <b>{money(x.price, l.currency)}</b> {l.currency}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {d.applicable.length > 30 && (
              <p className="text-muted-foreground">
                … và {d.applicable.length - 30} dòng nữa
              </p>
            )}
            {m.ambiguous.length > 0 && (
              <p className="mt-1 text-[var(--warn)]">
                <Nhan tone="warn">{m.ambiguous.length} dòng không rõ đơn</Nhan> mã SP có ở
                nhiều đơn — thêm cột mã đơn:{' '}
                {m.ambiguous
                  .slice(0, 4)
                  .map((a) => `${a.product_code} (${a.order_codes.join(', ')})`)
                  .join(' · ')}
              </p>
            )}
            {m.unmatched.length > 0 && (
              <p className="text-muted-foreground mt-1">
                {m.unmatched.length} mã không có trong đơn đang mở:{' '}
                {m.unmatched
                  .slice(0, 8)
                  .map((u) => u.product_code)
                  .join(', ')}
              </p>
            )}
            {d.parsed.errors.length > 0 && (
              <p className="mt-1 text-[var(--stop)]">
                {d.parsed.errors.length} dòng không đọc được:{' '}
                {d.parsed.errors
                  .slice(0, 4)
                  .map((e) => `dòng ${e.line} — ${e.reason}`)
                  .join(' · ')}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
