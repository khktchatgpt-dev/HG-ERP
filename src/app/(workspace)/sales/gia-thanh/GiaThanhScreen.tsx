'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Chip,
  CommitBar,
  Empty,
  Grid,
  GridBody,
  GridHead,
  GridRow,
  Metric,
  MetricStrip,
  NoticeBar,
  NumInput,
  Pick,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  Tag,
  Td,
  TextInput,
  Th,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { parsePriceText, type DecimalSep } from '@/lib/price-paste'
import {
  PLAN_WARN_PCT,
  planCheck,
  planDeviationPct,
  planPct,
  type BreakdownItem,
  type PlanCost,
  type PlanTarget,
} from '@/lib/plan-cost'
import type {
  PlanCostBoard,
  PlanCostRow,
} from '@/modules/dept/technical/plan-cost.service'
import { DanSheet, type PasteApply } from './dan-sheet'

const fmt = (n: number | null, cur: string | null) =>
  n == null
    ? '—'
    : n.toLocaleString('vi-VN', { maximumFractionDigits: cur === 'VND' ? 0 : 2, minimumFractionDigits: 0 }) // prettier-ignore
/** Số để GÕ LẠI được: không nhóm nghìn, dấu thập phân theo `sep` đang chọn. */
const fmtIn = (n: number, sep: DecimalSep) =>
  n.toLocaleString(sep === ',' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2, useGrouping: false }) // prettier-ignore
const pct = (p: number | null) => (p == null ? '—' : `${p.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`) // prettier-ignore
const dmy = (d: string | null) => (d ? d.split('-').reverse().join('/') : '')

type Draft = {
  direct: string
  overhead: string
  profit: string
  price: string
  breakdown?: BreakdownItem[]
  from_line?: number
}
const EMPTY_DRAFT: Draft = { direct: '', overhead: '', profit: '', price: '' }

/** Ô nào có chữ → dòng đang sửa. */
const isDirty = (d: Draft | undefined) =>
  !!d && (d.direct !== '' || d.overhead !== '' || d.profit !== '' || d.price !== '')

type Resolved =
  { ok: true; plan: PlanCost; derived_direct: boolean } | { ok: false; reason: string }

/**
 * Từ ô gõ ra bốn số. Trực tiếp để trống thì suy từ ba số kia (cùng luật với
 * hộp dán). Thiếu chung / lợi nhuận / FOB thì chưa lưu được.
 */
function resolve(d: Draft, sep: DecimalSep, currency: string): Resolved {
  const n = (s: string) => (s.trim() === '' ? null : parsePriceText(s, sep))
  const overhead = n(d.overhead)
  const profit = n(d.profit)
  const price = n(d.price)
  const directRaw = n(d.direct)
  if (overhead == null || profit == null || price == null)
    return { ok: false, reason: 'thiếu chi phí chung / lợi nhuận / FOB' }
  const direct = directRaw ?? Math.round((price - overhead - profit) * 100) / 100
  if (direct < 0 || overhead < 0 || price < 0) return { ok: false, reason: 'số âm' }
  const plan = { direct, overhead, profit, price }
  const chk = planCheck(plan, currency)
  if (!chk.ok)
    return { ok: false, reason: `trực tiếp + chung + lợi nhuận ≠ FOB (lệch ${chk.diff})` }
  return { ok: true, plan, derived_direct: directRaw == null }
}

type Filter = 'missing' | 'all' | { customer: string }

/**
 * GIÁ THÀNH KẾ HOẠCH — Khuôn F (dán · soát · lưu một lần), chép cách Bảng giá
 * đơn hàng. Bốn ô số một dòng; a%/b% là số SUY RA, đổi theo ô đang gõ để người
 * nhập thấy ngay "20% · 9%" như trong bảng tính của mình.
 *
 * Chặn tại chỗ: tổng ba khoản ≠ FOB thì dòng đỏ và thanh đáy nói đúng mã SP;
 * lệch quá 30% so với số đang có thì chỉ cảnh báo.
 */
export function GiaThanhScreen({
  board,
  canManage,
}: {
  board: PlanCostBoard
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>(board.stats.with_plan === board.stats.total ? 'all' : 'missing') // prettier-ignore
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const [currency, setCurrency] = useState<'USD' | 'VND'>('USD')
  const [sep, setSep] = useState<DecimalSep>('.')
  const [source, setSource] = useState('')
  const [fxRate, setFxRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [sheet, setSheet] = useState<{ mode: 'table' } | { mode: 'block'; row: PlanCostRow } | null>(null) // prettier-ignore
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>())

  const targets = useMemo<PlanTarget[]>(
    () => board.rows.map((r) => ({ product_id: r.product_id, code: r.code, customer_code: r.customer_item_code })), // prettier-ignore
    [board.rows],
  )
  const customers = useMemo(
    () => board.stats.missing_by_customer.slice(0, 4),
    [board.stats.missing_by_customer],
  )

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return board.rows.filter((r) => {
      if (filter === 'missing' && r.price != null && !isDirty(draft[r.product_id]))
        return false
      if (typeof filter === 'object' && (r.customer_name ?? '— chưa rõ khách —') !== filter.customer) return false // prettier-ignore
      if (!needle) return true
      return (
        r.code.toLowerCase().includes(needle) ||
        (r.customer_item_code?.toLowerCase().includes(needle) ?? false) ||
        r.name.toLowerCase().includes(needle) ||
        (r.customer_name?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [board.rows, filter, q, draft])

  /** Dòng đang sửa → kết quả kiểm. Nguồn chung cho thanh đáy, dải trên và tô dòng. */
  const dirty = useMemo(() => {
    const out: { row: PlanCostRow; d: Draft; res: Resolved }[] = []
    for (const r of board.rows) {
      const d = draft[r.product_id]
      if (!isDirty(d)) continue
      out.push({ row: r, d, res: resolve(d, sep, currency) })
    }
    return out
  }, [board.rows, draft, sep, currency])
  const bad = dirty.filter((x) => !x.res.ok)
  const warn = dirty.filter(
    (x) => x.res.ok && Math.abs(planDeviationPct(x.res.plan.price, x.row.price) ?? 0) > PLAN_WARN_PCT, // prettier-ignore
  )
  const blocked = !canManage
    ? 'Chỉ Bán hàng và Kỹ thuật nạp được giá thành kế hoạch'
    : dirty.length === 0
      ? ''
      : bad.length > 0
        ? `${bad[0].row.code}: ${bad[0].res.ok ? '' : bad[0].res.reason}${bad.length > 1 ? ` (+${bad.length - 1} dòng nữa)` : ''} — sửa rồi mới lưu được`
        : !source.trim()
          ? 'Ghi tên bản báo giá đã lấy số ở ô Nguồn'
          : ''

  function setCell(id: string, k: keyof Draft, v: string): void {
    setDraft((p) => ({ ...p, [id]: { ...(p[id] ?? EMPTY_DRAFT), [k]: v } }))
  }

  function applyPaste(items: PasteApply[]): void {
    const s = (n: number) => String(n)
    setDraft((p) => {
      const next = { ...p }
      for (const it of items) {
        next[it.product_id] = {
          direct: s(it.plan.direct),
          overhead: s(it.plan.overhead),
          profit: s(it.plan.profit),
          price: s(it.plan.price),
          breakdown: it.breakdown,
          from_line: it.from_line,
        }
      }
      return next
    })
    // Số dán ra dạng "144.5" → dấu chấm, để ô đọc đúng.
    setSep('.')
    if (filter === 'missing') setFilter('all')
  }

  async function save(): Promise<void> {
    if (blocked || busy || dirty.length === 0) return
    setBusy(true)
    try {
      const fx = fxRate.trim() ? parsePriceText(fxRate, sep) : null
      const r = await api<{ updated: number }>('/api/dept/sales/gia-thanh', {
        method: 'PATCH',
        body: {
          items: dirty.map((x) => ({
            product_id: x.row.product_id,
            ...(x.res.ok ? x.res.plan : { direct: 0, overhead: 0, profit: 0, price: 0 }),
            ...(x.d.breakdown ? { breakdown: x.d.breakdown } : {}),
          })),
          currency,
          fx_rate: fx,
          source: source.trim(),
        },
      })
      toast.success(`Đã lưu giá thành kế hoạch cho ${r.updated} sản phẩm`, `Nguồn: ${source.trim()}`) // prettier-ignore
      setDraft({})
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  function goBlocked(): void {
    const id = bad[0]?.row.product_id
    if (!id) return
    if (filter === 'missing') setFilter('all')
    const el = rowRefs.current.get(id)
    el?.scrollIntoView({ block: 'center' })
    el?.querySelector<HTMLInputElement>('input')?.focus()
  }

  const s = board.stats

  return (
    <div className="theme-v3 kit text-foreground -m-6 flex min-h-0 flex-col">
      <ScreenFrame tableMin={1120}>
        <ScreenHeader
          compact
          eyebrow="Bán hàng"
          title="Giá thành kế hoạch"
          actions={
            <>
              <Btn
                icon="them"
                primary
                onClick={() => setSheet({ mode: 'table' })}
                blockedBy={canManage ? undefined : 'Bán hàng / Kỹ thuật'}
              >
                Dán từ bảng tính giá
              </Btn>
              <Btn icon="tien" href="/sales/orders/gia">
                Bảng giá đơn hàng
              </Btn>
            </>
          }
        />

        <MetricStrip>
          <Metric
            label="SP đang chạy có giá thành KH"
            value={String(s.with_plan)}
            basis={`/ ${s.total} SP trong lệnh đang chạy và đơn bán còn sống`}
            tone={
              s.total > 0 && s.with_plan === s.total
                ? 'done'
                : s.with_plan === 0
                  ? 'warn'
                  : undefined
            }
          />
          <Metric
            label="Đủ 4 số, FOB khớp tổng"
            value={String(s.complete)}
            basis={`/ ${s.total} · trực tiếp + chi phí chung + lợi nhuận = FOB`}
            tone={s.complete < s.with_plan ? 'warn' : undefined}
          />
          <Metric
            label="Theo khách còn thiếu"
            value={
              customers.filter((c) => c.missing > 0).length === 0
                ? '0'
                : customers
                    .filter((c) => c.missing > 0)
                    .slice(0, 2)
                    .map((c) => `${c.customer} ${c.missing}`)
                    .join(' · ')
            }
            basis={
              customers
                .slice(2)
                .map((c) => `${c.customer} ${c.missing}/${c.total}`)
                .join(' · ') || 'mọi khách đã đủ'
            }
          />
          <Metric
            label="Đang sửa chưa lưu"
            value={String(dirty.length)}
            basis={
              dirty.length === 0
                ? 'gõ vào ô hoặc dán từ bảng tính'
                : `${dirty.filter((x) => x.d.from_line != null).length} từ khối dán · ${dirty.filter((x) => x.d.from_line == null).length} gõ tay`
            }
            tone={bad.length > 0 ? 'stop' : undefined}
          />
        </MetricStrip>

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] px-[var(--gutter)] py-2">
          <SearchInput
            value={q}
            onChange={setQ}
            label="Tìm sản phẩm"
            placeholder="Tìm mã HG, mã khách, tên SP, khách…"
            width={260}
          />
          <Chip
            on={filter === 'missing'}
            onClick={() => setFilter('missing')}
            count={s.total - s.with_plan}
          >
            Chỉ SP chưa có
          </Chip>
          <Chip on={filter === 'all'} onClick={() => setFilter('all')} count={s.total}>
            Tất cả đang chạy
          </Chip>
          {customers.map((c) => (
            <Chip
              key={c.customer}
              on={typeof filter === 'object' && filter.customer === c.customer}
              onClick={() => setFilter({ customer: c.customer })}
              count={c.total}
            >
              {c.customer}
            </Chip>
          ))}
          <span className="text-k-sm ml-auto text-[var(--ink-3)]">
            a% = chung / trực tiếp · b% = lợi nhuận / (trực tiếp + chung) — số suy ra,
            không nhập
          </span>
        </div>

        {/*
          THIẾT LẬP CỦA LẦN LƯU — một hàng riêng trên bảng, không nhét vào thanh
          đáy (đo 02/10/2026 ở 1280px: bốn ô + nút Lưu làm thanh đáy gãy ba
          dòng). Áp cho mọi dòng đang sửa: tiền tệ của bản báo giá, dấu thập phân
          khi gõ, tỷ giá Sale dùng trong bảng tính, và tên bản báo giá.
        */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] py-1.5">
          <span className="text-k-label text-[var(--ink-label)]">Lần lưu này</span>
          <Pick
            label="Tiền tệ của bản báo giá"
            width={80}
            value={currency}
            disabled={!canManage || busy}
            onChange={(v) => setCurrency(v as 'USD' | 'VND')}
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'VND', label: 'VND' },
            ]}
          />
          <Pick
            label="Dấu thập phân khi gõ"
            width={130}
            value={sep}
            disabled={!canManage || busy}
            onChange={(v) => setSep(v as DecimalSep)}
            options={[
              { value: '.', label: 'Chấm 144.00' },
              { value: ',', label: 'Phẩy 144,00' },
            ]}
          />
          <NumInput
            aria-label="Tỷ giá Sale dùng trong bảng tính"
            value={fxRate}
            placeholder="tỷ giá bảng tính (26.000)"
            disabled={!canManage || busy}
            style={{ width: 170 }}
            onCommit={setFxRate}
          />
          <div className="min-w-[260px] flex-1">
            <TextInput
              label="Nguồn — tên bản báo giá"
              value={source}
              placeholder="Nguồn: Quotation - Halston 10/07/2026"
              disabled={!canManage || busy}
              onCommit={setSource}
            />
          </div>
        </div>

        {warn.length > 0 && (
          <NoticeBar tone="warn" tag="Lệch nhiều">
            {warn.length} dòng có giá FOB mới lệch quá {PLAN_WARN_PCT}% so với số đang có
            (
            {warn
              .slice(0, 3)
              .map(
                (x) =>
                  `${x.row.code} ${fmt(x.row.price, currency)} → ${x.res.ok ? fmt(x.res.plan.price, currency) : ''}`,
              )
              .join(' · ')}
            ) — thường là thiếu số 0 hoặc dán nhầm cột. Vẫn lưu được.
          </NoticeBar>
        )}

        <div className="min-h-0 flex-1 overflow-auto">
          {rows.length === 0 ? (
            <Empty
              headline={
                board.rows.length === 0
                  ? 'Chưa có SP nào đang chạy'
                  : filter === 'missing'
                    ? `${s.with_plan}/${s.total} SP đang chạy đã có giá thành kế hoạch`
                    : 'Không SP nào ở nhóm này'
              }
              reason={
                board.rows.length === 0
                  ? 'Bảng này chỉ bày SP nằm trong lệnh đang chạy hoặc đơn bán còn sống — chưa có lệnh/đơn nào thì chưa có gì để nạp.'
                  : filter === 'missing'
                    ? 'Không còn SP nào thiếu. Bỏ chip "Chỉ SP chưa có" để xem và sửa số đang có.'
                    : 'Bộ lọc hoặc ô tìm đang thu hẹp danh sách.'
              }
              next={
                <Btn
                  icon="boLoc"
                  onClick={() => {
                    setFilter('all')
                    setQ('')
                  }}
                >
                  Xem tất cả
                </Btn>
              }
            />
          ) : (
            <Grid minWidth={1120}>
              <GridHead>
                <Th width={104}>Mã HG</Th>
                <Th width={112}>Mã khách</Th>
                <Th>Tên SP</Th>
                <Th width={76}>Khách</Th>
                <Th num width={88}>
                  Trực tiếp
                </Th>
                <Th num width={88}>
                  Chi phí chung
                </Th>
                <Th num width={52}>
                  a%
                </Th>
                <Th num width={88}>
                  Lợi nhuận
                </Th>
                <Th num width={52}>
                  b%
                </Th>
                <Th num width={88}>
                  Giá FOB
                </Th>
                <Th width={40}>TT</Th>
                <Th width={160}>Nguồn · ngày</Th>
                <Th width={140}>Trạng thái</Th>
              </GridHead>
              <GridBody>
                {rows.map((r) => {
                  const d = draft[r.product_id]
                  const dirtyRow = isDirty(d)
                  const res = dirtyRow ? resolve(d!, sep, currency) : null
                  const live = res?.ok ? res.plan : null
                  const pcts = live
                    ? planPct(live)
                    : r.price != null
                      ? { a: r.a_pct, b: r.b_pct }
                      : { a: null, b: null }
                  const dev = live ? planDeviationPct(live.price, r.price) : null
                  const cell = (k: keyof Draft, saved: number | null) => (
                    <NumInput
                      aria-label={`${k} của ${r.code}`}
                      value={
                        d?.[k] != null && typeof d[k] === 'string' ? (d[k] as string) : ''
                      }
                      // Gợi ý theo DẤU đang chọn, không theo vi-VN: gợi "28,8" khi ô
                      // đọc dấu chấm thì người gõ lại đúng chữ đó sẽ ra 288.
                      placeholder={saved == null ? '' : fmtIn(saved, sep)}
                      disabled={!canManage || busy}
                      style={{ width: 88 }}
                      onCommit={(v) => setCell(r.product_id, k, v)}
                    />
                  )
                  return (
                    <GridRow key={r.product_id} selected={dirtyRow}>
                      <Td>
                        <span className="num">{r.code}</span>
                      </Td>
                      <Td>
                        <span className="num">{r.customer_item_code ?? '—'}</span>
                      </Td>
                      <Td>
                        <span title={r.name}>{r.name}</span>{' '}
                        <span className="text-k-label ml-1 text-[var(--ink-3)]">
                          {r.lsx_count > 0 ? `${r.lsx_count} lệnh` : ''}
                          {r.lsx_count > 0 && r.order_count > 0 ? ' · ' : ''}
                          {r.order_count > 0 ? `${r.order_count} đơn` : ''}
                        </span>
                      </Td>
                      <Td>{r.customer_name ?? '—'}</Td>
                      <Td num>{cell('direct', r.direct)}</Td>
                      <Td num>{cell('overhead', r.overhead)}</Td>
                      <Td num>
                        <span className="text-[var(--ink-3)]">{pct(pcts.a)}</span>
                      </Td>
                      <Td num>{cell('profit', r.profit)}</Td>
                      <Td num>
                        <span className="text-[var(--ink-3)]">{pct(pcts.b)}</span>
                      </Td>
                      <Td num tone={res && !res.ok ? 'stop' : undefined}>
                        {cell('price', r.price)}
                      </Td>
                      <Td>{dirtyRow ? currency : (r.currency ?? '—')}</Td>
                      <Td>
                        {r.source ? (
                          <span
                            className="text-[var(--ink-2)]"
                            title={`${r.source} · ${dmy(r.at)}${r.by_name ? ` · ${r.by_name}` : ''}`}
                          >
                            {' '}
                            {/* prettier-ignore */}
                            {r.source}
                            <span className="text-k-label text-[var(--ink-3)]">
                              {' '}
                              · {dmy(r.at)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-[var(--ink-3)]">—</span>
                        )}
                      </Td>
                      <Td>
                        {res && !res.ok ? (
                          <Tag tone="stop">{res.reason}</Tag>
                        ) : dirtyRow ? (
                          <>
                            <Tag tone="run">
                              {d?.from_line
                                ? `khối dán · dòng ${d.from_line}`
                                : d?.breakdown
                                  ? 'khối chi phí'
                                  : 'gõ tay'}
                            </Tag>
                            {dev != null && Math.abs(dev) > PLAN_WARN_PCT && (
                              <Tag tone="warn">
                                {dev > 0 ? '+' : ''}
                                {pct(dev)} so số đang có
                              </Tag>
                            )}
                          </>
                        ) : r.price == null ? (
                          <Tag tone="warn">chưa có</Tag>
                        ) : !r.complete ? (
                          <Tag tone="warn">FOB ≠ tổng 3 số</Tag>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <Tag tone="done">đủ</Tag>
                            {r.breakdown && r.breakdown.length > 0 && (
                              <span
                                className="text-k-label text-[var(--ink-3)]"
                                title={r.breakdown
                                  .map((b) => `${b.label} ${fmt(b.amount, r.currency)}`)
                                  .join(' · ')}
                              >
                                {r.breakdown.length} khoản
                              </span>
                            )}
                          </span>
                        )}
                        {canManage && !dirtyRow && (
                          <button
                            type="button"
                            className="text-k-label ml-2 text-[var(--act)] underline"
                            onClick={() => setSheet({ mode: 'block', row: r })}
                          >
                            dán khối
                          </button>
                        )}
                      </Td>
                    </GridRow>
                  )
                })}
              </GridBody>
            </Grid>
          )}
        </div>

        <CommitBar
          totals={[
            { label: 'Dòng đổi', value: <span className="num">{dirty.length}</span> },
            { label: 'Lệch tổng', value: <span className="num">{bad.length}</span> },
          ]}
          grand={{ label: 'Nguồn', value: source.trim() || '—' }}
          blocked={blocked}
          onGoBlocked={bad.length > 0 ? goBlocked : undefined}
          actions={
            <>
              <Btn
                icon="ghiSo"
                primary
                busy={busy}
                disabled={!!blocked || dirty.length === 0}
                onClick={() => void save()}
              >
                Lưu {dirty.length > 0 ? `${dirty.length} dòng` : ''}
              </Btn>
            </>
          }
        />
      </ScreenFrame>

      {sheet && (
        <DanSheet
          mode={sheet.mode}
          product={sheet.mode === 'block' ? { product_id: sheet.row.product_id, code: sheet.row.code, name: sheet.row.name } : null} // prettier-ignore
          targets={targets}
          currency={currency}
          onClose={() => setSheet(null)}
          onApply={applyPaste}
        />
      )}
    </div>
  )
}
