'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Printer,
  ShieldCheck,
  StickyNote,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { isBigApproval } from '@/lib/exec-ops'
import { cn } from '@/lib/utils'
import { waitingDays } from './approval-helpers'
import {
  useApprovalDecision,
  targetLsx,
  targetPo,
  targetQuote,
} from './useApprovalDecision'
import {
  daysUntil,
  dueBadge,
  DUE_TEXT,
  Fact,
  fmtD,
  fmtTr,
  fmtVnd,
  LsxProductTable,
  OrderInfo,
  PoLineTable,
  SectionLabel,
  Signal,
  type DueTone,
} from './approval-parts'
import type { PendingLsx, PendingPo, PendingQuote } from './approval-types'

/**
 * TRANG CHI TIẾT đơn duyệt — KHÁC buồng lái: bố cục 2 cột, cột phải là thẻ
 * "Quyết định" DÍNH (số liệu chốt + verdict + nút Duyệt/Từ chối + link nhanh),
 * cột trái là hồ sơ đầy đủ (chuỗi liên kết, thông tin đơn, bảng SP/vật tư,
 * dòng thời gian). Duyệt/từ chối xong quay về danh sách.
 */
export function ApprovalDetailScreen(
  props:
    | { kind: 'lsx'; item: PendingLsx; nowIso: string }
    | { kind: 'po'; item: PendingPo; nowIso: string }
    | { kind: 'quote'; item: PendingQuote; nowIso: string },
) {
  const router = useRouter()
  // Ký xong quay về TRUNG TÂM PHÊ DUYỆT (15/08, exec v3) — nơi phiếu chờ nằm;
  // /exec giờ là trang Tổng quan.
  const dec = useApprovalDecision(() => {
    router.push('/exec/approvals')
    router.refresh()
  })

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/exec/approvals"
        className="text-muted-foreground hover:text-foreground -ml-1 inline-flex w-fit items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" /> Chờ tôi phê duyệt
      </Link>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {props.kind === 'lsx' ? (
          <LsxBody l={props.item} nowIso={props.nowIso} dec={dec} />
        ) : props.kind === 'quote' ? (
          <QuoteBody q={props.item} nowIso={props.nowIso} dec={dec} />
        ) : (
          <PoBody p={props.item} nowIso={props.nowIso} dec={dec} />
        )}
      </div>

      {dec.dialogs}
    </div>
  )
}

type Dec = ReturnType<typeof useApprovalDecision>

// ── Mảnh dùng chung cho trang ────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-card rounded-xl border p-5">{children}</div>
}

function Chain({ nodes }: { nodes: { label: string; value: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      {nodes.map((n, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="text-muted-foreground/50 size-3" />}
          <span className="text-muted-foreground">{n.label}</span>
          <span className="font-mono font-medium">{n.value}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * LUỒNG DUYỆT — ai tạo → đang chờ ai → bước kế tiếp là gì. Bước `future` (sau
 * chữ ký) vẽ mờ + chấm rỗng: Giám đốc thấy chữ ký của mình mở khoá việc gì.
 */
function Timeline({
  steps,
}: {
  steps: { label: string; date: string; now?: boolean; future?: boolean }[]
}) {
  return (
    <div>
      <SectionLabel>Luồng duyệt</SectionLabel>
      <ol className="mt-2.5 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'mt-0.5 size-2.5 shrink-0 rounded-full',
                  s.now
                    ? 'bg-amber-500 ring-4 ring-amber-500/20'
                    : s.future
                      ? 'border-muted-foreground/40 border bg-transparent'
                      : 'bg-muted-foreground/40',
                )}
              />
              {i < steps.length - 1 && <span className="bg-border/70 mt-1 w-px flex-1" />}
            </div>
            <div className={cn('-mt-0.5 pb-1', s.future && 'opacity-60')}>
              <div className={cn('text-sm', s.now ? 'font-semibold' : 'font-medium')}>
                {s.label}
              </div>
              <div className="text-muted-foreground text-xs">{s.date}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Thẻ "Quyết định" dính bên phải: metric + verdict + số chốt + nút + link. */
function DecisionCard({
  kind,
  code,
  title,
  metric,
  metricLabel,
  metricTone,
  verdict,
  stats,
  busy,
  onApprove,
  onReject,
  links,
}: {
  kind: 'lsx' | 'po' | 'quote'
  code: string
  title: string
  metric: string
  metricLabel: string
  metricTone?: 'red'
  verdict: { tone: 'ok' | 'warn' | 'alert'; node: React.ReactNode }
  stats: { label: string; value: React.ReactNode; tone?: DueTone }[]
  busy: boolean
  onApprove: () => void
  onReject: () => void
  links: React.ReactNode
}) {
  return (
    <aside className="bg-card order-1 rounded-xl border lg:sticky lg:top-4 lg:order-2">
      <div className="border-border/60 border-b p-4">
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <span className="font-medium tracking-wide uppercase">
            {kind === 'lsx'
              ? 'Lệnh sản xuất'
              : kind === 'quote'
                ? 'Báo giá'
                : 'Đơn đặt vật tư'}
          </span>
          <span className="font-mono">{code}</span>
        </div>
        <div className="mt-0.5 truncate font-semibold">{title}</div>
        <div
          className={cn(
            'mt-3 text-2xl font-bold tabular-nums',
            metricTone === 'red' && 'text-red-600 dark:text-red-400',
          )}
        >
          {metric}
        </div>
        <div className="text-muted-foreground text-[11px]">{metricLabel}</div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <Signal tone={verdict.tone}>{verdict.node}</Signal>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {stats.map((s, i) => (
            <div key={i} className="min-w-0">
              <dt className="text-muted-foreground text-[11px]">{s.label}</dt>
              <dd
                className={cn('mt-0.5 text-sm font-semibold', s.tone && DUE_TEXT[s.tone])}
              >
                {s.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-2 pt-1">
          <Button className="w-full" disabled={busy} onClick={onApprove}>
            <ShieldCheck /> Phê duyệt
          </Button>
          <Button variant="outline" className="w-full" disabled={busy} onClick={onReject}>
            Từ chối
          </Button>
        </div>

        <div className="border-border/60 flex flex-col gap-1.5 border-t pt-3 text-sm">
          {links}
        </div>
      </div>
    </aside>
  )
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="text-sky-600 hover:underline dark:text-sky-400"
    >
      {children}
    </a>
  )
}

// ── Thân LSX ─────────────────────────────────────────────────────────────────
function LsxBody({ l, nowIso, dec }: { l: PendingLsx; nowIso: string; dec: Dec }) {
  const days = waitingDays(l.created_at, nowIso)
  const due = dueBadge(daysUntil(l.ship_date, nowIso))
  const bomPending = l.bom_pending ?? 0
  const waitTone: DueTone = days >= 4 ? 'red' : days >= 2 ? 'amber' : 'muted'

  const verdict: { tone: 'ok' | 'warn' | 'alert'; node: React.ReactNode } =
    bomPending > 0
      ? {
          tone: 'alert',
          node: (
            <span>
              <b>{bomPending} SP chưa chốt BOM.</b> Kỹ thuật cần hoàn tất BOM thì xưởng
              mới đủ định mức.
            </span>
          ),
        }
      : due.tone === 'red'
        ? { tone: 'alert', node: <span>Hạn giao {due.text} — duyệt sớm.</span> }
        : days >= 2
          ? { tone: 'warn', node: <span>Đã chờ {days} ngày.</span> }
          : { tone: 'ok', node: <span>BOM đủ, sẵn sàng sản xuất.</span> }

  return (
    <>
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <Card>
          <Chain
            nodes={[
              {
                label: l.order_codes.length > 1 ? 'Đơn hàng (gộp)' : 'Đơn hàng',
                value: l.order_codes.join(', ') || '—',
              },
              { label: 'LSX', value: l.code },
            ]}
          />
          <h1 className="mt-2 text-xl font-bold">{l.customer_name}</h1>
          <div className="text-muted-foreground mt-0.5 text-sm">
            Lệnh sản xuất chờ Giám đốc duyệt
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <Fact label="Hạn giao khách" tone={due.tone}>
                <span className="inline-flex items-center gap-1">
                  <Truck className="size-3.5" />
                  {fmtD(l.ship_date)} · {due.text}
                </span>
              </Fact>
              <Fact label="Ngày nhận">{fmtD(l.received_date)}</Fact>
              <Fact label="Người phát lệnh">{l.issued_by_name ?? '—'}</Fact>
            </dl>

            {l.order && <OrderInfo o={l.order} />}
            <LsxProductTable lines={l.lines ?? []} />

            {l.container_summary && l.container_summary.trim() && (
              <div>
                <SectionLabel>Đóng container</SectionLabel>
                <p className="mt-1 text-sm whitespace-pre-wrap">{l.container_summary}</p>
              </div>
            )}
            {l.note && l.note.trim() && (
              <div>
                <SectionLabel>
                  <span className="inline-flex items-center gap-1">
                    <StickyNote className="size-3.5" /> Ghi chú
                  </span>
                </SectionLabel>
                <p className="mt-1 text-sm whitespace-pre-wrap">{l.note}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <Timeline
            steps={[
              ...(l.order
                ? [{ label: 'Khách đặt đơn', date: fmtD(l.order.order_created_at) }]
                : []),
              {
                label: 'Kinh doanh phát lệnh SX',
                date: [fmtD(l.created_at), l.issued_by_name].filter(Boolean).join(' · '),
              },
              {
                label: `Chờ Giám đốc duyệt${days >= 1 ? ` · ${days} ngày` : ''}`,
                date: 'Hiện tại',
                now: true,
              },
              {
                label: 'Phát hành lệnh — Cung ứng đặt vật tư, xưởng nhận việc',
                date: 'Sau khi ký',
                future: true,
              },
            ]}
          />
        </Card>
      </div>

      <DecisionCard
        kind="lsx"
        code={l.code}
        title={l.customer_name}
        metric={l.order_value ? fmtTr(l.order_value) : '—'}
        metricLabel="Giá trị đơn hàng"
        verdict={verdict}
        stats={[
          { label: 'Hạn giao', value: due.text, tone: due.tone },
          {
            label: 'Chờ duyệt',
            value: days >= 1 ? `${days} ngày` : 'mới',
            tone: waitTone,
          },
          {
            label: 'BOM',
            value: bomPending > 0 ? `${bomPending} chưa chốt` : 'Đủ',
            tone: bomPending > 0 ? 'red' : undefined,
          },
          { label: 'Số SP', value: `${(l.lines ?? []).length}` },
        ]}
        busy={dec.busy}
        onApprove={() => dec.askApprove(targetLsx(l))}
        onReject={() => dec.askReject(targetLsx(l))}
        links={
          <>
            <QuickLink href={`/print/lsx/${l.id}`}>
              <Printer className="mr-1 inline size-3.5" /> Bản in LSX
            </QuickLink>
            <Link
              href={`/exec/lsx/${l.id}`}
              className="text-sky-600 hover:underline dark:text-sky-400"
            >
              <FileText className="mr-1 inline size-3.5" /> Hồ sơ sản xuất đầy đủ →
            </Link>
          </>
        }
      />
    </>
  )
}

// ── Thân BÁO GIÁ (0149 — duyệt tuỳ chọn) ─────────────────────────────────────
function QuoteBody({ q, nowIso, dec }: { q: PendingQuote; nowIso: string; dec: Dec }) {
  const days = waitingDays(q.submitted_at ?? q.created_at, nowIso)
  const waitTone: DueTone = days >= 4 ? 'red' : days >= 2 ? 'amber' : 'muted'
  const fmtPrice = (v: number) =>
    new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: q.currency === 'VND' ? 0 : 2,
    }).format(v)

  // Dòng chào THẤP HƠN lần trước cho cùng khách — thứ GĐ cần soi nhất khi ký giá.
  const cheaper = q.lines.filter(
    (l) => l.last_price && l.unit_price < l.last_price.unit_price,
  )

  const verdict: { tone: 'ok' | 'warn' | 'alert'; node: React.ReactNode } =
    cheaper.length > 0
      ? {
          tone: 'warn',
          node: (
            <span>
              <b>{cheaper.length} sản phẩm chào thấp hơn lần trước</b> — xem cột “Lần chào
              trước” trước khi ký.
            </span>
          ),
        }
      : days >= 2
        ? { tone: 'warn', node: <span>Đã chờ {days} ngày.</span> }
        : {
            tone: 'ok',
            node: <span>Không dòng nào thấp hơn giá đã chào trước cho khách này.</span>,
          }

  return (
    <>
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <Card>
          <Chain nodes={[{ label: 'Báo giá', value: q.code }]} />
          <h1 className="mt-2 text-xl font-bold">{q.customer_name}</h1>
          <div className="text-muted-foreground mt-0.5 text-sm">
            Báo giá chờ Giám đốc duyệt — duyệt xong Sale mới chốt &amp; gửi khách
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <Fact label="Hiệu lực">
                {q.valid_from || q.valid_to
                  ? `${fmtD(q.valid_from)} → ${fmtD(q.valid_to)}`
                  : '—'}
              </Fact>
              <Fact label="Điều kiện giá">{q.price_term ?? '—'}</Fact>
              <Fact label="Thanh toán">{q.payment_terms ?? '—'}</Fact>
              <Fact label="Người trình">{q.submitted_by_name ?? '—'}</Fact>
              <Fact label="Trình ngày">{fmtD(q.submitted_at)}</Fact>
            </dl>

            <div>
              <SectionLabel>Bảng giá chào ({q.lines.length} sản phẩm)</SectionLabel>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-muted-foreground border-b text-xs tracking-wide uppercase">
                    <tr>
                      <th className="py-1.5 pe-3 text-left">Sản phẩm</th>
                      <th className="py-1.5 pe-3 text-right">Đơn giá ({q.currency})</th>
                      <th className="py-1.5 pe-3 text-right">CK %</th>
                      <th className="py-1.5 text-right">Lần chào trước</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {q.lines.map((l, i) => {
                      const lower = l.last_price && l.unit_price < l.last_price.unit_price
                      return (
                        <tr key={i}>
                          <td className="py-1.5 pe-3">
                            <div className="font-medium">{l.product_code}</div>
                            <div className="text-muted-foreground text-xs">
                              {l.product_name}
                              {l.note ? ` · ${l.note}` : ''}
                            </div>
                          </td>
                          <td
                            className={cn(
                              'py-1.5 pe-3 text-right font-semibold tabular-nums',
                              lower && 'text-amber-700 dark:text-amber-400',
                            )}
                          >
                            {fmtPrice(l.unit_price)}
                          </td>
                          <td className="text-muted-foreground py-1.5 pe-3 text-right tabular-nums">
                            {l.discount_pct ?? '—'}
                          </td>
                          <td className="text-muted-foreground py-1.5 text-right text-xs tabular-nums">
                            {l.last_price
                              ? `${fmtPrice(l.last_price.unit_price)} (${l.last_price.quote_code})`
                              : 'chưa từng chào'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {q.note && q.note.trim() && (
              <div>
                <SectionLabel>
                  <span className="inline-flex items-center gap-1">
                    <StickyNote className="size-3.5" /> Ghi chú
                  </span>
                </SectionLabel>
                <p className="mt-1 text-sm whitespace-pre-wrap">{q.note}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <Timeline
            steps={[
              { label: 'Sale lập báo giá', date: fmtD(q.created_at) },
              {
                label: 'Trình Giám đốc duyệt',
                date: [fmtD(q.submitted_at), q.submitted_by_name]
                  .filter(Boolean)
                  .join(' · '),
              },
              {
                label: `Chờ Giám đốc duyệt${days >= 1 ? ` · ${days} ngày` : ''}`,
                date: 'Hiện tại',
                now: true,
              },
              {
                label: 'Sale chốt & gửi khách',
                date: 'Sau khi ký',
                future: true,
              },
            ]}
          />
        </Card>
      </div>

      <DecisionCard
        kind="quote"
        code={q.code}
        title={q.customer_name}
        metric={`${q.lines.length} SP`}
        metricLabel="Số dòng chào giá"
        verdict={verdict}
        stats={[
          {
            label: 'Chờ duyệt',
            value: days >= 1 ? `${days} ngày` : 'mới',
            tone: waitTone,
          },
          { label: 'Tiền tệ', value: q.currency },
          {
            label: 'Thấp hơn lần trước',
            value: cheaper.length > 0 ? `${cheaper.length} dòng` : 'Không',
            tone: cheaper.length > 0 ? 'amber' : undefined,
          },
          { label: 'Hiệu lực đến', value: fmtD(q.valid_to) },
        ]}
        busy={dec.busy}
        onApprove={() => dec.askApprove(targetQuote(q))}
        onReject={() => dec.askReject(targetQuote(q))}
        links={
          <QuickLink href={`/print/quotes/${q.id}`}>
            <Printer className="mr-1 inline size-3.5" /> Bản in báo giá
          </QuickLink>
        }
      />
    </>
  )
}

// ── Thân PO ──────────────────────────────────────────────────────────────────
function PoBody({ p, nowIso, dec }: { p: PendingPo; nowIso: string; dec: Dec }) {
  const big = isBigApproval(p.total)
  const days = waitingDays(p.created_at, nowIso)
  const due = dueBadge(daysUntil(p.expected_at, nowIso))
  const lines = p.lines ?? []
  const missingPrice = lines.filter((ln) => ln.unit_price == null).length
  const waitTone: DueTone = days >= 4 ? 'red' : days >= 2 ? 'amber' : 'muted'

  const verdict: { tone: 'ok' | 'warn' | 'alert'; node: React.ReactNode } = big
    ? {
        tone: 'alert',
        node: (
          <span>
            <b>Giá trị lớn (≥50tr).</b> Cần xem kỹ từng dòng trước khi duyệt chi.
          </span>
        ),
      }
    : missingPrice > 0
      ? {
          tone: 'warn',
          node: <span>{missingPrice} dòng chưa có đơn giá — tổng có thể chưa đủ.</span>,
        }
      : due.tone === 'red'
        ? {
            tone: 'alert',
            node: <span>Hàng hẹn về {due.text} — duyệt để kịp gửi NCC.</span>,
          }
        : days >= 2
          ? { tone: 'warn', node: <span>Đã chờ {days} ngày.</span> }
          : {
              tone: 'ok',
              node: <span>Sẵn sàng — duyệt để Cung ứng gửi NCC (BR-05).</span>,
            }

  return (
    <>
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <Card>
          <Chain
            nodes={[
              ...(p.order_code ? [{ label: 'Đơn hàng', value: p.order_code }] : []),
              ...(p.lsx_code ? [{ label: 'LSX', value: p.lsx_code }] : []),
              { label: 'Đơn vật tư', value: p.code },
            ]}
          />
          <h1 className="mt-2 text-xl font-bold">{p.supplier_name}</h1>
          <div className="text-muted-foreground mt-0.5 text-sm">
            Đơn đặt vật tư chờ Giám đốc duyệt (BR-05)
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              <Fact label="Hàng hẹn về" tone={due.tone}>
                <span className="inline-flex items-center gap-1">
                  <Truck className="size-3.5" />
                  {fmtD(p.expected_at)} · {due.text}
                </span>
              </Fact>
              <Fact label="Người lập đơn">{p.created_by_name ?? '—'}</Fact>
              <Fact label="Lập ngày">{fmtD(p.created_at)}</Fact>
            </dl>

            <PoLineTable lines={lines} total={p.total} />

            {p.note && p.note.trim() && (
              <div>
                <SectionLabel>
                  <span className="inline-flex items-center gap-1">
                    <StickyNote className="size-3.5" /> Ghi chú đơn đặt
                  </span>
                </SectionLabel>
                <p className="mt-1 text-sm whitespace-pre-wrap">{p.note}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <Timeline
            steps={[
              {
                label: 'Cung ứng lập đơn đặt',
                date: [fmtD(p.created_at), p.created_by_name].filter(Boolean).join(' · '),
              },
              {
                label: `Chờ Giám đốc duyệt${days >= 1 ? ` · ${days} ngày` : ''}`,
                date: 'Hiện tại',
                now: true,
              },
              {
                label: 'Cung ứng gửi đơn cho NCC (BR-05)',
                date: 'Sau khi ký',
                future: true,
              },
            ]}
          />
        </Card>
      </div>

      <DecisionCard
        kind="po"
        code={p.code}
        title={p.supplier_name}
        metric={`${fmtVnd(p.total)} ₫`}
        metricLabel="Tổng cam kết chi"
        metricTone={big ? 'red' : undefined}
        verdict={verdict}
        stats={[
          { label: 'Hàng hẹn về', value: due.text, tone: due.tone },
          {
            label: 'Chờ duyệt',
            value: days >= 1 ? `${days} ngày` : 'mới',
            tone: waitTone,
          },
          { label: 'Cho LSX', value: p.lsx_code ?? 'Ngoài LSX' },
          { label: 'Số dòng', value: `${lines.length}` },
        ]}
        busy={dec.busy}
        onApprove={() => dec.askApprove(targetPo(p))}
        onReject={() => dec.askReject(targetPo(p))}
        links={
          <QuickLink href={`/print/supply/${p.id}`}>
            <Printer className="mr-1 inline size-3.5" /> Bản in đơn đặt
          </QuickLink>
        }
      />
    </>
  )
}
