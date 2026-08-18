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
import { cn } from '@/lib/utils'
import { money, moneyByCurrency, waitingDays } from './approval-helpers'
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

      {/*
        Chặn bề rộng ở 1600px: đây là màn ĐỌC ĐỂ KÝ, trải hết màn 1900px thì mắt
 phải quét ngang cả gang tay giữa tên sản phẩm và cột quy cách.

        Tách 2 cột từ 1280px chứ không phải 1024px: dưới ngưỡng đó thẻ quyết định
        ăn mất 340px, cột hồ sơ chỉ còn ~640px và bảng sản phẩm bị bóp nát. Xếp
 chồng thì thẻ quyết định nằm TRÊN (order-1) — mở phiếu là thấy ngay số
 tiền, cảnh báo và hai nút ký, không phải cuộn xuống đáy tìm.
      */}
      <div className="mx-auto grid w-full max-w-[1600px] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
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
                    ? 'bg-[var(--warn)] ring-4 ring-[color-mix(in_srgb,var(--warn)_25%,transparent)]'
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
    // @container: thẻ này sống ở hai bề rộng rất khác nhau — 340px khi làm cột
    // phải, gần 1200px khi xếp chồng ở cửa sổ hẹp. Số liệu và nút bám theo bề
    // rộng THỰC của thẻ, khỏi kéo dài thượt một cột khi nằm ngang.
    <aside className="bg-card @container order-1 rounded-xl border xl:sticky xl:top-4 xl:order-2">
      {/*
        MỘT bộ đánh dấu, HAI hình dạng theo bề rộng thật của thẻ:

        · cột phải 340px → xếp dọc như cũ (danh tính → tiền → cảnh báo → số liệu
          → nút → link), vì bề ngang không đủ cho gì khác;
        · xếp chồng ~1150px → gom thành 3 hàng ngang: [danh tính + tiền | nút] /
 [cảnh báo] / [số liệu · link]. Bản trước giữ nguyên kiểu cột dọc ở mọi
 bề rộng nên nằm ngang là cao lêu nghêu, ăn hết màn hình đầu tiên mà
 chữ thì thưa thớt — mở phiếu ra chưa thấy sản phẩm đâu.
      */}
      <div className="@xl:grid @xl:grid-cols-[minmax(0,1fr)_auto] @xl:items-start @xl:gap-x-5 @xl:gap-y-3 @xl:p-4">
        <div className="border-border/60 border-b p-4 @xl:col-start-1 @xl:row-start-1 @xl:border-b-0 @xl:p-0">
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-medium tracking-wide uppercase">
              {kind === 'lsx'
                ? 'Lệnh sản xuất'
                : kind === 'quote'
                  ? 'Báo giá'
                  : 'Đơn đặt vật tư'}
            </span>
            <span className="font-mono">{code}</span>
            <span className="text-foreground truncate font-semibold @xl:before:mx-1 @xl:before:content-['·']">
              {title}
            </span>
          </div>
          {/* Nằm ngang thì tiền và nhãn của nó về CÙNG một dòng — hai dòng chỉ
              để dành cho cột dọc, nơi bề ngang không cho phép. */}
          <div className="mt-2 flex flex-col @xl:mt-1 @xl:flex-row @xl:items-baseline @xl:gap-2">
            <span
              className={cn(
                'text-2xl font-bold tabular-nums',
                metricTone === 'red' && 'text-[var(--stop)]',
              )}
            >
              {metric}
            </span>
            <span className="text-muted-foreground text-[11px]">{metricLabel}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 @xl:contents">
          <div className="@xl:col-span-2 @xl:row-start-2">
            <Signal tone={verdict.tone}>{verdict.node}</Signal>
          </div>

          {/* Số liệu: cột dọc xếp lưới 2 cột; nằm ngang thì rải thành một hàng
              "nhãn giá-trị · nhãn giá-trị" — thấp hơn hẳn mà đọc vẫn rõ. */}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 @xl:col-start-1 @xl:row-start-3 @xl:flex @xl:flex-wrap @xl:items-baseline @xl:gap-x-5 @xl:gap-y-1.5">
            {stats.map((s, i) => (
              <div key={i} className="min-w-0 @xl:flex @xl:items-baseline @xl:gap-1.5">
                <dt className="text-muted-foreground text-[11px]">{s.label}</dt>
                <dd
                  className={cn(
                    'mt-0.5 text-sm font-semibold @xl:mt-0',
                    s.tone && DUE_TEXT[s.tone],
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Thứ tự khi xếp DỌC phải là … số liệu → NÚT → link (nút là việc
 chính, link là lối rẽ). Nằm ngang thì lưới xếp lại: nút lên hàng 1
 cạnh số tiền, link xuống hàng 3 cùng dòng với số liệu. */}
          <div className="flex flex-col gap-2 pt-1 @xl:col-start-2 @xl:row-start-1 @xl:flex-row-reverse @xl:justify-self-end @xl:pt-0">
            <Button className="w-full @xl:w-36" disabled={busy} onClick={onApprove}>
              <ShieldCheck /> Phê duyệt
            </Button>
            <Button
              variant="outline"
              className="w-full @xl:w-28"
              disabled={busy}
              onClick={onReject}
            >
              Từ chối
            </Button>
          </div>

          <div className="border-border/60 flex flex-col gap-1.5 border-t pt-3 text-sm @xl:col-start-2 @xl:row-start-3 @xl:flex-row @xl:justify-end @xl:gap-4 @xl:border-t-0 @xl:pt-0">
            {links}
          </div>
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
      className="text-[var(--primary)] hover:underline"
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
  // Giá trị lệnh theo TIỀN TỆ của từng đơn (lệnh gộp có thể lẫn USD/VND —
  // 0113). Không còn quy ra "tr" đồng như bản cũ: đơn MERXX là USD.
  const orderValue = l.orders?.length
    ? moneyByCurrency(l.orders)
    : l.order_value && l.order
      ? money(l.order_value, l.order.currency)
      : '—'

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
      <div className="order-2 flex flex-col gap-4 xl:order-1">
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
            {/* Ô rỗng thì KHÔNG in "—" chiếm chỗ: màn duyệt nào cũng chỉ nên
 bày thứ có thật để mắt bám ngay vào hạn giao. */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              {/* `wrap`: mặc định Fact cắt cụt bằng `truncate`, mà "29/11/2026 ·
 còn 104 ngày" là thứ KHÔNG được phép cụt trên màn ký. */}
              <Fact label="Hạn giao khách" tone={due.tone} wrap>
                {/* Ngày và "còn N ngày" tách hai dòng: gộp một dòng thì ở cột
 hẹp nó ngắt bừa giữa cụm, bỏ icon lại trơ một mình. */}
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Truck className="size-3.5 shrink-0" />
                  {fmtD(l.ship_date)}
                </span>
                <span className="block text-xs font-normal">{due.text}</span>
              </Fact>
              {l.received_date && <Fact label="Ngày nhận">{fmtD(l.received_date)}</Fact>}
              {l.issued_by_name && (
                <Fact label="Người phát lệnh">{l.issued_by_name}</Fact>
              )}
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
        metric={orderValue}
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
              className="text-[var(--primary)] hover:underline"
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
      <div className="order-2 flex flex-col gap-4 xl:order-1">
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
                              lower && 'text-[var(--warn)]',
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
  // `big` tính ở server theo TIỀN TỆ của đơn (approvals/data.ts). Trước
  // 17/08/2026 chỗ này gọi isBigApproval(p.total) — so mọi tiền tệ với ngưỡng
  // 50tr VND, nên đơn 3.000 USD hiện ra "sẵn sàng ký" đúng như bẫy mà ngưỡng
  // sinh ra để chặn. Danh sách phê duyệt đã đúng từ trước; chỉ trang này sót.
  const big = p.big ?? false
  const noThreshold = p.threshold == null
  const days = waitingDays(p.created_at, nowIso)
  const due = dueBadge(daysUntil(p.expected_at, nowIso))
  const lines = p.lines ?? []
  const missingPrice = lines.filter((ln) => ln.unit_price == null).length
  const waitTone: DueTone = days >= 4 ? 'red' : days >= 2 ? 'amber' : 'muted'

  const verdict: { tone: 'ok' | 'warn' | 'alert'; node: React.ReactNode } = big
    ? {
        tone: 'alert',
        node: noThreshold ? (
          <span>
            <b>Chưa đặt ngưỡng cho {p.currency}.</b> Mặc định coi là đơn lớn — đặt ngưỡng
            ở Luật ký nếu muốn ký nhanh.
          </span>
        ) : (
          <span>
            <b>Giá trị lớn (≥ {money(p.threshold!, p.currency)}).</b> Cần xem kỹ từng dòng
            trước khi duyệt chi.
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
      <div className="order-2 flex flex-col gap-4 xl:order-1">
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
              <Fact label="Hàng hẹn về" tone={due.tone} wrap>
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <Truck className="size-3.5 shrink-0" />
                  {fmtD(p.expected_at)}
                </span>
                <span className="block text-xs font-normal">{due.text}</span>
              </Fact>
              <Fact label="Người lập đơn">{p.created_by_name ?? '—'}</Fact>
              <Fact label="Lập ngày">{fmtD(p.created_at)}</Fact>
            </dl>

            <PoLineTable lines={lines} total={p.total} currency={p.currency} />

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
        metric={money(p.total, p.currency)}
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
