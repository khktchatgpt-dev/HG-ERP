'use client'

import Link from 'next/link'
import type { KeyboardEvent } from 'react'
import { ChevronDown, ChevronRight, ClipboardPaste, Save, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { planPct, PLAN_WARN_PCT, planDeviationPct } from '@/lib/plan-cost'
import type { DecimalSep } from '@/lib/price-paste'
import type {
  LastSeenPrice,
  PlanCostBoard,
  PlanCostRow,
} from '@/modules/dept/technical/plan-cost.service'
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
} from '../_erp/ui'
import { BTN_PRI, BTN_SUB, CELL, INPUT } from '../orders/_form/don-form.shared'
import { KhoiDan } from './khoi-dan'
import { custOf, useGiaThanh, type DraftKey, type GiaThanhCtx } from './useGiaThanh'

const TH =
  'h-7 border-b border-border bg-muted px-2 text-left text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase'
const TD = 'h-[44px] border-b border-border px-2 align-middle text-[13px]'
const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'
const SUB = 'text-muted-foreground block truncate text-[11px] leading-4'

const fmt = (n: number | null, cur: string | null) =>
  n == null
    ? '—'
    : n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2 })
/** Số để GÕ LẠI được: không nhóm nghìn, dấu thập phân theo `sep` đang chọn. */
const fmtIn = (n: number, sep: DecimalSep) =>
  n.toLocaleString(sep === ',' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 2,
    useGrouping: false,
  })
const pct = (p: number | null) =>
  p == null ? '—' : `${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`
const dmy = (d: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')

/** Enter / ↓ xuống cùng cột dòng dưới, ↑ lên — bảng tính. */
function gridKey(e: KeyboardEvent<HTMLInputElement>, r: number, c: DraftKey) {
  if (e.key !== 'Enter' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const el = document.querySelector<HTMLInputElement>(
    `[data-r="${e.key === 'ArrowUp' ? r - 1 : r + 1}"][data-c="${c}"]`,
  )
  if (el) {
    e.preventDefault()
    el.focus()
    el.select()
  }
}

/**
 * GIÁ THÀNH KẾ HOẠCH — khuôn F (Bảng nhập liệu, kiểu ERP — 08/10/2026). Tập SP
 * = SP trong lệnh đang chạy hoặc đơn bán còn sống. Bốn ô số một dòng (trực
 * tiếp · chung · lợi nhuận · FOB), a%/b% suy ra khi gõ; cạnh đó là giá đã chào
 * và giá đơn gần nhất để người nạp thấy số đang bán. Gõ / dán chỉ điền vào ô,
 * Lưu MỘT lần; thanh chốt đáy nói vì sao chưa lưu được.
 */
export function GiaThanhScreen({
  board,
  canManage,
}: {
  board: PlanCostBoard
  canManage: boolean
}) {
  const d = useGiaThanh(board, canManage)
  const s = board.stats
  const missing = s.total - s.with_plan
  const topMissing = d.customers.filter((c) => c.missing > 0)
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[{ label: 'Bán hàng', href: '/sales' }, { label: 'Giá thành kế hoạch' }]}
        title="Giá thành kế hoạch"
        sub="Bốn số từ bảng tính giá của Sale cho SP đang chạy — gõ hay dán đều chỉ điền vào ô, bạn soát rồi mới lưu một lần."
        actions={
          <>
            <ToolBtn
              onClick={() =>
                d.paste?.kind === 'table'
                  ? d.closePaste()
                  : d.openPaste({ kind: 'table' })
              }
              icon={ClipboardPaste}
            >
              Dán từ bảng tính
            </ToolBtn>
            <ToolBtn onClick={d.save} icon={Save} primary>
              Lưu {d.dirty.length} dòng
            </ToolBtn>
          </>
        }
      />

      <CountStrip>
        <CountCell
          label="SP chưa có giá KH"
          value={String(missing)}
          sub={`trên ${s.total} SP đang chạy`}
          tone={missing ? 'stop' : 'done'}
          on={d.view === 'missing'}
          onClick={() => d.setView('missing')}
        />
        <CountCell
          label="Chỉ FOB, chưa bóc tách"
          value={String(s.fob_only)}
          sub="có giá chốt, không có bảng tính"
          tone={s.fob_only ? 'warn' : 'neutral'}
          on={d.view === 'fob_only'}
          onClick={() => d.setView('fob_only')}
        />
        <CountCell
          label="Đủ 4 số, khớp tổng"
          value={String(s.complete)}
          sub="trực tiếp + chung + lợi nhuận = FOB"
          tone={s.complete === s.total && s.total > 0 ? 'done' : 'neutral'}
          on={d.view === 'all'}
          onClick={() => d.setView('all')}
        />
        <CountCell
          label="Khách thiếu nhiều nhất"
          value={topMissing[0] ? String(topMissing[0].missing) : '0'}
          sub={
            topMissing[0]
              ? `${topMissing[0].customer} · ${topMissing[0].total} SP`
              : 'mọi khách đã đủ'
          }
          on={topMissing[0] ? d.customer === topMissing[0].customer : false}
          onClick={
            topMissing[0]
              ? () =>
                  d.setCustomer(
                    d.customer === topMissing[0].customer
                      ? 'all'
                      : topMissing[0].customer,
                  )
              : undefined
          }
        />
        <CountCell
          label="Đang sửa"
          value={String(d.dirty.length)}
          sub={
            d.dirty.length
              ? d.bad.length
                ? `${d.bad.length} dòng chưa hợp lệ`
                : 'chưa lưu'
              : 'chưa gõ gì'
          }
          tone={d.bad.length ? 'stop' : 'neutral'}
        />
      </CountStrip>

      <FilterRow>
        <Seg
          label="Hiện"
          value={d.view}
          onChange={d.setView}
          options={[
            { value: 'missing', label: 'Chưa có', count: missing },
            { value: 'fob_only', label: 'Chỉ FOB', count: s.fob_only },
            { value: 'all', label: 'Tất cả', count: s.total },
          ]}
        />
        <Chon
          label="Khách"
          value={d.customer}
          onChange={d.setCustomer}
          options={[
            { value: 'all', label: 'Mọi khách' },
            ...d.customers.map((c) => ({
              value: c.customer,
              label: `${c.customer} (${c.missing ? `thiếu ${c.missing}/` : ''}${c.total})`,
            })),
          ]}
          width={220}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tìm
          <input
            value={d.q}
            onChange={(e) => d.setQ(e.target.value)}
            placeholder="mã HG · mã khách · tên SP · khách"
            className={`${INPUT} w-[240px]`}
          />
        </label>
      </FilterRow>

      {/*
        THIẾT LẬP CỦA LẦN LƯU — hàng riêng trên bảng, không nhét vào thanh đáy
        (đo 02/10/2026 ở 1280px: bốn ô + nút Lưu làm thanh đáy gãy ba dòng). Áp
        cho mọi dòng đang sửa.
      */}
      <div className="border-border bg-muted/40 flex flex-wrap items-center gap-4 border-b px-6 py-1.5">
        <span className="text-muted-foreground text-xs font-semibold uppercase">
          Lần lưu này
        </span>
        <Seg
          label="Tiền tệ"
          value={d.currency}
          onChange={d.setCurrency}
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'VND', label: 'VND' },
          ]}
        />
        <Seg
          label="Dấu thập phân"
          value={d.sep}
          onChange={d.setSep}
          options={[
            { value: '.', label: '144.00' },
            { value: ',', label: '144,00' },
          ]}
        />
        <label className="text-muted-foreground flex items-center gap-2 text-xs">
          Tỷ giá bảng tính
          <input
            id="gt-fx"
            value={d.fxRate}
            onChange={(e) => d.setFxRate(e.target.value)}
            placeholder="26.000"
            inputMode="decimal"
            disabled={!canManage || d.busy}
            className={`${INPUT} w-[110px] ${NUM} ${d.fxBad ? 'border-[var(--stop)]' : ''}`}
          />
        </label>
        <label className="text-muted-foreground flex min-w-[280px] flex-1 items-center gap-2 text-xs">
          Nguồn
          <input
            id="gt-source"
            value={d.source}
            onChange={(e) => d.setSource(e.target.value)}
            placeholder="tên bản báo giá đã lấy số — vd: Quotation Halston 10/07/2026"
            disabled={!canManage || d.busy}
            className={`${INPUT} ${d.dirty.length && !d.source.trim() ? 'border-[var(--warn)]' : ''}`}
          />
        </label>
      </div>

      <KhoiDan d={d} />

      {d.warn.length > 0 && (
        <div className="border-border border-b bg-[var(--warn)]/10 px-6 py-1.5 text-[13px]">
          <Nhan tone="warn">Lệch nhiều</Nhan> {d.warn.length} dòng có FOB mới lệch quá{' '}
          {PLAN_WARN_PCT}% so với số đang có (
          {d.warn
            .slice(0, 3)
            .map((r) => {
              const x = d.resolved.get(r.product_id)!
              return `${r.code} ${fmt(r.price, d.currency)} → ${x.ok ? fmt(x.price, d.currency) : ''}`
            })
            .join(' · ')}
          ) — thường là thiếu số 0 hoặc dán nhầm cột. Vẫn lưu được.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />
            <col />
            <col className="w-[110px]" />
            <col className="w-[92px]" />
            <col className="w-[92px]" />
            <col className="w-[46px]" />
            <col className="w-[92px]" />
            <col className="w-[46px]" />
            <col className="w-[96px]" />
            <col className="w-[104px]" />
            <col className="w-[104px]" />
            <col className="w-[170px]" />
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={`${TH} text-right`}>#</th>
              <th className={TH}>Sản phẩm · mã khách</th>
              <th className={TH}>Khách</th>
              <th className={`${TH} text-right`}>Trực tiếp</th>
              <th className={`${TH} text-right`}>Chung</th>
              <th className={`${TH} text-right`}>a%</th>
              <th className={`${TH} text-right`}>Lợi nhuận</th>
              <th className={`${TH} text-right`}>b%</th>
              <th className={`${TH} text-right`}>Giá FOB</th>
              <th className={`${TH} text-right`}>Đã chào</th>
              <th className={`${TH} text-right`}>Giá đơn</th>
              <th className={TH}>Tình trạng · nguồn</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="text-muted-foreground px-6 py-10 text-center text-[13px]"
                >
                  {board.rows.length === 0
                    ? 'Chưa có SP nào đang chạy — bảng này chỉ bày SP nằm trong lệnh đang chạy hoặc đơn bán còn sống.'
                    : d.view === 'missing'
                      ? `${s.with_plan}/${s.total} SP đang chạy đã có giá — chuyển "Tất cả" để sửa số đang có.`
                      : 'Không SP nào khớp bộ lọc.'}
                </td>
              </tr>
            )}
            {d.rows.map((r, i) => (
              <Dong key={r.product_id} d={d} r={r} i={i} />
            ))}
          </tbody>
          {d.rows.length > 0 && (
            <tfoot className="sticky bottom-0 z-10">
              <tr className="bg-muted text-[12px] font-medium">
                <td className="border-border h-8 border-t px-2" colSpan={12}>
                  <span className="text-muted-foreground">
                    {d.rows.length} SP đang hiện · {d.dirty.length} dòng sẽ lưu
                    {d.bad.length > 0 && (
                      <span className="text-[var(--stop)]">
                        {' '}
                        · {d.bad.length} dòng chưa hợp lệ
                      </span>
                    )}
                    {' · '}a% = chung / trực tiếp · b% = lợi nhuận / (trực tiếp + chung) —
                    số suy ra, không nhập
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Thanh chốt đáy: luôn hiện — nói rõ vì sao chưa lưu được, bấm vào là nhảy tới chỗ. */}
      <div className="border-border bg-card sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t px-6 py-2">
        <span className="text-[13px]">
          <span className="font-mono font-semibold tabular-nums">{d.dirty.length}</span>
          <span className="text-muted-foreground"> dòng sẽ lưu · {d.currency}</span>
          {d.source.trim() && (
            <span className="text-muted-foreground"> · nguồn: {d.source.trim()}</span>
          )}
        </span>
        <span className="bg-border h-4 w-px" />
        {d.missing.length ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-[13px]">
            <span className="text-[var(--stop)]">Chưa lưu được:</span>
            {d.missing.map((m, i) => (
              <button
                key={i}
                type="button"
                className="truncate underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
                onClick={() => {
                  if (!m.focus) return
                  if (m.focus.startsWith('gt-') && d.view !== 'all') d.setView('all')
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
          <span className="flex-1 text-[13px] text-[var(--done)]">
            Đủ điều kiện lưu
            {d.warn.length > 0 ? ` — ${d.warn.length} dòng lệch nhiều, bạn đã soát?` : ''}
          </span>
        )}
        <button
          type="button"
          className={BTN_SUB}
          onClick={d.reset}
          disabled={d.busy || !d.dirty.length}
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
        left="Tập SP = nằm trong lệnh đang chạy hoặc đơn bán còn sống · ô trống = giữ số đang có (cùng tiền tệ) · một dòng lệch tổng là từ chối cả lô"
        right={
          <Link
            href="/sales/orders/gia"
            className="hover:text-[var(--primary)] hover:underline"
          >
            Điền đơn giá đơn hàng →
          </Link>
        }
      />
    </ErpPage>
  )
}

function GiaGanNhat({ p, cur }: { p: LastSeenPrice | null; cur: string | null }) {
  if (!p) return <span className="text-muted-foreground">—</span>
  const other = cur != null && p.currency !== cur
  return (
    <>
      {fmt(p.price, p.currency)}
      <span
        className={`${SUB} text-right font-sans ${other ? 'text-[var(--warn)]' : ''}`}
        title={`${p.code} · ${dmy(p.at)}${p.customer ? ` · ${p.customer}` : ''}`}
      >
        {other ? p.currency : p.code}
      </span>
    </>
  )
}

function Dong({ d, r, i }: { d: GiaThanhCtx; r: PlanCostRow; i: number }) {
  const draft = d.draft[r.product_id]
  const res = d.resolved.get(r.product_id)
  const dirty = !!res
  const live = res?.ok ? res : null
  const same = r.currency == null || r.currency === d.currency
  const pcts =
    live && live.direct != null && live.overhead != null && live.profit != null
      ? planPct({ direct: live.direct, overhead: live.overhead, profit: live.profit })
      : live
        ? { a: null, b: null }
        : { a: r.a_pct, b: r.b_pct }
  const dev = live && same ? planDeviationPct(live.price, r.price) : null
  const cur = dirty ? d.currency : r.currency
  const isOpen = d.open.has(r.product_id)
  const canOpen = (r.breakdown?.length ?? 0) > 0 || !!draft?.breakdown
  const bd = draft?.breakdown ?? r.breakdown ?? []

  const cell = (k: DraftKey, saved: number | null) => (
    <input
      id={`gt-${r.product_id}-${k}`}
      data-r={i}
      data-c={k}
      inputMode="decimal"
      disabled={!d.canManage || d.busy}
      value={draft?.[k] ?? ''}
      onChange={(e) => d.setCell(r.product_id, k, e.target.value)}
      onKeyDown={(e) => gridKey(e, i, k)}
      // Gợi ý theo DẤU đang chọn, không theo vi-VN: gợi "28,8" khi ô đọc dấu chấm
      // thì người gõ lại đúng chữ đó sẽ ra 288. Khác tiền tệ thì không gợi — số
      // đó không được mượn.
      placeholder={
        k === 'direct' && live?.derived_direct && live.direct != null
          ? fmtIn(live.direct, d.sep)
          : saved == null || !same
            ? ''
            : fmtIn(saved, d.sep)
      }
      aria-label={`${k} của ${r.code}`}
      className={`${CELL} ${NUM} ${
        res && !res.ok
          ? 'border-[var(--stop)]'
          : draft?.[k]
            ? 'border-[var(--primary)]'
            : ''
      }`}
    />
  )

  return (
    <>
      <tr
        className={`${dirty ? 'bg-[var(--accent)]/40' : 'hover:bg-muted/40'} ${res && !res.ok ? 'bg-[var(--stop)]/5' : ''}`}
      >
        <td className={`${TD} ${NUM} text-muted-foreground`}>{i + 1}</td>
        <td className={`${TD} min-w-0`}>
          <span className="flex items-center gap-1">
            {canOpen ? (
              <button
                type="button"
                className="text-muted-foreground -ml-1 shrink-0 hover:text-[var(--primary)]"
                onClick={() => d.toggleOpen(r.product_id)}
                aria-expanded={isOpen}
                aria-label="Xem khối chi phí"
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
              </button>
            ) : null}
            <Link
              href={`/products/${r.product_id}`}
              className="truncate font-mono text-xs text-[var(--primary)] hover:underline"
              title={r.name}
            >
              {r.code}
            </Link>
            {r.customer_item_code && (
              <span
                className="text-muted-foreground truncate font-mono text-xs"
                title={`Mã khách ${r.customer_item_code}`}
              >
                · {r.customer_item_code}
              </span>
            )}
          </span>
          <span className={SUB} title={r.name}>
            {r.name}
            <span className="text-muted-foreground">
              {r.lsx_count > 0 ? ` · ${r.lsx_count} lệnh` : ''}
              {r.order_count > 0 ? ` · ${r.order_count} đơn` : ''}
            </span>
          </span>
        </td>
        <td className={`${TD} min-w-0`}>
          <span className="block truncate" title={custOf(r)}>
            {custOf(r)}
          </span>
        </td>
        <td className={`${TD} px-1`}>{cell('direct', r.direct)}</td>
        <td className={`${TD} px-1`}>{cell('overhead', r.overhead)}</td>
        <td className={`${TD} ${NUM} text-muted-foreground text-xs`}>{pct(pcts.a)}</td>
        <td className={`${TD} px-1`}>{cell('profit', r.profit)}</td>
        <td className={`${TD} ${NUM} text-muted-foreground text-xs`}>{pct(pcts.b)}</td>
        <td className={`${TD} px-1`}>
          {cell('price', r.price)}
          <span className={`${SUB} text-right`}>{cur ?? ''}</span>
        </td>
        <td className={`${TD} ${NUM}`}>
          <GiaGanNhat p={r.last_quote} cur={cur} />
        </td>
        <td className={`${TD} ${NUM}`}>
          <GiaGanNhat p={r.last_order} cur={cur} />
        </td>
        <td className={`${TD} min-w-0`}>
          {res && !res.ok ? (
            <Nhan tone="stop">{res.reason}</Nhan>
          ) : live ? (
            <span className="flex flex-wrap items-center gap-1">
              <Nhan tone="neutral">
                {live.fob_only
                  ? 'chỉ FOB'
                  : draft?.from_line
                    ? `khối dán · dòng ${draft.from_line}`
                    : draft?.breakdown
                      ? 'khối chi phí'
                      : 'đang sửa'}
              </Nhan>
              {dev != null && Math.abs(dev) > PLAN_WARN_PCT && (
                <Nhan tone="warn">
                  {dev > 0 ? '+' : ''}
                  {pct(dev)}
                </Nhan>
              )}
              <button
                type="button"
                className="text-muted-foreground text-[11px] hover:text-[var(--primary)] hover:underline"
                onClick={() => d.clearRow(r.product_id)}
              >
                bỏ
              </button>
            </span>
          ) : r.price == null ? (
            <Nhan tone="stop">chưa có</Nhan>
          ) : r.direct == null ? (
            <Nhan tone="warn">chỉ FOB</Nhan>
          ) : !r.complete ? (
            <Nhan tone="warn">FOB ≠ tổng 3 số</Nhan>
          ) : (
            <Nhan tone="done">đủ</Nhan>
          )}
          {!dirty && (
            <span
              className={SUB}
              title={
                r.source
                  ? `${r.source} · ${dmy(r.at)}${r.by_name ? ` · ${r.by_name}` : ''}`
                  : undefined
              }
            >
              {r.source ? `${r.source} · ${dmy(r.at)}` : ''}
              {d.canManage && (
                <button
                  type="button"
                  className="ml-1 text-[var(--primary)] hover:underline"
                  onClick={() => d.openPaste({ kind: 'block', row: r })}
                >
                  dán khối
                </button>
              )}
            </span>
          )}
        </td>
      </tr>
      {isOpen && bd.length > 0 && (
        <tr className="bg-muted/30">
          <td />
          <td colSpan={11} className="border-border border-b px-2 py-1.5 text-xs">
            <span className="text-muted-foreground mr-2">
              Khối chi phí trực tiếp ({bd.length} khoản
              {draft?.breakdown ? ', vừa dán' : ''}):
            </span>
            {bd.map((b, j) => (
              <span key={j} className="mr-3 inline-block whitespace-nowrap">
                {b.label}{' '}
                <span className="font-mono tabular-nums">{fmt(b.amount, cur)}</span>
              </span>
            ))}
          </td>
        </tr>
      )}
    </>
  )
}
