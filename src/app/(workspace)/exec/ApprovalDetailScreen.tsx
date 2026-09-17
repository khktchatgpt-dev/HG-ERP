'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Package,
  Printer,
  ShieldCheck,
  StickyNote,
  TrendingUp,
  TriangleAlert,
  Truck,
  Undo2,
} from 'lucide-react'
import { Btn, DocChain, FactKv, ScreenFrame, StatusBar, Timeline } from '@/components/kit'
import { cn } from '@/lib/utils'
import { money, moneyByCurrency, waitingDays } from './approval-helpers'
import {
  useApprovalDecision,
  targetLsx,
  targetPo,
  targetQuote,
} from './useApprovalDecision'
import {
  comparePrice,
  daysUntil,
  dueBadge,
  DUE_TEXT,
  Fact,
  fmtD,
  fmtVnd,
  LsxProductTable,
  OrderInfo,
  PoLineTable,
  SectionLabel,
  Signal,
  type DueTone,
} from './approval-parts'
import type { ApprovalNav, PendingLsx, PendingPo, PendingQuote } from './approval-types'

/**
 * TRANG CHI TIẾT đơn duyệt — KHÁC buồng lái: bố cục 2 cột, cột phải là thẻ
 * "Quyết định" DÍNH (số liệu chốt + verdict + nút Duyệt/Từ chối + link nhanh),
 * cột trái là hồ sơ đầy đủ (chuỗi liên kết, thông tin đơn, bảng SP/vật tư,
 * dòng thời gian). Duyệt/từ chối xong quay về danh sách.
 */
export function ApprovalDetailScreen(
  props:
    | { kind: 'lsx'; item: PendingLsx; nowIso: string }
    | { kind: 'po'; item: PendingPo; nowIso: string; nav?: ApprovalNav }
    | { kind: 'quote'; item: PendingQuote; nowIso: string },
) {
  const router = useRouter()
  // Ký xong quay về TRUNG TÂM PHÊ DUYỆT (15/08, exec v3) — nơi phiếu chờ nằm;
  // /exec giờ là trang Tổng quan.
  const dec = useApprovalDecision(() => {
    router.push('/exec/approvals')
    router.refresh()
  })

  /*
    ĐƠN MUA tự quản cả bố cục — kể cả khay phải và thanh trạng thái — vì nó
    thiết kế lại theo khuôn màn chứng từ: dải quyết định NGANG trên đầu, lưới
    chiếm phần còn lại. Bọc nó trong lưới 2 cột của bản cũ là ép một bố cục vào
    trong một bố cục khác.

    LSX và Báo giá giữ nguyên khung cũ (cột hồ sơ + thẻ quyết định 340px): hai
    loại đó hiện 0 phiếu chờ nên không kiểm được trên dữ liệu thật, và đổi mù
    một màn không ai mở là cách chắc chắn để làm hỏng nó trong im lặng.
  */
  if (props.kind === 'po') {
    return (
      <ScreenFrame>
        <PoBody p={props.item} nowIso={props.nowIso} dec={dec} nav={props.nav} />
        {dec.dialogs}
      </ScreenFrame>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/exec/approvals"
        className="-ml-1 inline-flex w-fit items-center gap-1 text-[var(--fs-sm)] text-[var(--ink-3)] hover:text-[var(--ink)]"
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
        ) : null}
      </div>

      {dec.dialogs}
    </div>
  )
}

type Dec = ReturnType<typeof useApprovalDecision>

// ── Mảnh dùng chung cho trang ────────────────────────────────────────────────

/**
 * KHỐI PHẲNG, không phải thẻ nổi (chuyển kit 17/09/2026).
 *
 * Bản cũ là `rounded-xl border p-5` — một tờ giấy trắng nổi trên nền xám, lặp
 * ba lần trên một màn. Luật kit: khối ngăn nhau bằng MỘT VẠCH MẢNH, lưới sát
 * mép. Đổi đi thì màn cao hơn được ~40px và mắt hết phải nhảy qua ba cái viền
 * để đọc một hồ sơ liền mạch.
 */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-[11px]">
      {children}
    </section>
  )
}

/**
 * LUỒNG DUYỆT — ai tạo → đang chờ ai → bước kế tiếp là gì.
 *
 * Dùng `Timeline` của kit thay vì tự vẽ (17/09/2026): kit đã có đúng thứ này
 * cho mọi chứng từ, và mốc CHƯA xảy ra khai `at: null` thì nó tự bày mờ với
 * chấm rỗng — Giám đốc thấy chữ ký của mình mở khoá việc gì. Bản cũ vẽ lại
 * cùng một dải bằng 35 dòng và một bộ màu riêng.
 */
function FlowSteps({
  steps,
  nowIso,
}: {
  steps: {
    label: string
    /** Chữ hiện dưới nhãn: "1/9/2026 · Lệ Hằng", "Hiện tại", "Sau khi ký". */
    date: string
    /** ISO THẬT của mốc, nếu có. Thiếu thì mốc vẫn tính là đã xảy ra. */
    iso?: string | null
    now?: boolean
    future?: boolean
  }[]
  /** Mốc "bây giờ" — dùng cho bước đang đứng. Truyền từ server, không `new Date()`. */
  nowIso: string
}) {
  return (
    <>
      <SectionLabel>Luồng duyệt</SectionLabel>
      <div className="mt-2">
        <Timeline
          marks={steps.map((s, i) => ({
            key: String(i),
            /*
              `at` PHẢI là ISO thật, không phải cờ đánh dấu.

              Bản đầu tiên nhét một hằng số ('2000-01-01') vào đây chỉ để kit
              hiểu "mốc đã xảy ra", vì ngày người-đọc-được đã nằm ở `detail`.
              Kit in `at` ra thật, nên khay hiện "01/01 07:00" ngay cạnh
              "1/9/2026" — một cái ngày không có thật trên màn duyệt chi tiền.
              Mốc tương lai để null; kit tự bày mờ và ghi "chưa tới".
            */
            at: s.future ? null : (s.iso ?? nowIso),
            label: s.label,
            detail: s.date,
            tone: s.now ? ('warn' as const) : undefined,
          }))}
        />
      </div>
    </>
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
    /*
      KHAY PHẲNG, dính bên phải (chuyển kit 17/09/2026).

      KHÔNG dùng `InspectPanel` của kit dù nó đúng vai: khay đó khai
      `hidden xl:flex` và rộng cố định 316px, hợp cho màn DANH SÁCH nơi bảng
      chiếm phần còn lại. Ở màn ĐỌC ĐỂ KÝ thì dưới 1280px khay phải xếp chồng
      lên TRÊN (order-1) — mở phiếu là thấy ngay số tiền, cảnh báo và hai nút;
      ẩn nó đi thì trên laptop 13" Giám đốc không ký được.

      Bỏ `rounded-xl` và đổ bóng: ngăn với cột hồ sơ bằng một vạch dọc khi nằm
      cạnh, một vạch ngang khi xếp chồng.
    */
    <aside className="@container order-1 border-b border-[var(--line)] bg-[var(--surface-card)] xl:sticky xl:top-0 xl:order-2 xl:border-b-0 xl:border-l">
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
        <div className="border-b border-[var(--line)] p-4 @xl:col-start-1 @xl:row-start-1 @xl:border-b-0 @xl:p-0">
          <div className="flex flex-wrap items-center gap-x-2 text-[var(--fs-sm)] text-[var(--ink-3)]">
            <span className="font-medium tracking-wide uppercase">
              {kind === 'lsx'
                ? 'Lệnh sản xuất'
                : kind === 'quote'
                  ? 'Báo giá'
                  : 'Đơn đặt vật tư'}
            </span>
            <span className="font-mono">{code}</span>
            <span className="truncate font-semibold text-[var(--ink)] @xl:before:mx-1 @xl:before:content-['·']">
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
            <span className="text-[var(--fs-micro)] text-[var(--ink-3)]">
              {metricLabel}
            </span>
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
                <dt className="text-[var(--fs-micro)] text-[var(--ink-3)]">{s.label}</dt>
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
            <Btn
              primary
              className="w-full justify-center @xl:w-36"
              disabled={busy}
              onClick={onApprove}
            >
              <ShieldCheck className="size-4" aria-hidden /> Phê duyệt
            </Btn>
            {/*
              "TRẢ LẠI ĐỂ SỬA" — cùng một tên với Trung tâm phê duyệt và sổ
              lịch sử ký. Phiếu quay về nháp, giữ số và lịch sử, người soạn sửa
              rồi gửi lại; đây là nơi CUỐI cùng còn gọi nó là "Từ chối".
            */}
            <Btn
              className="w-full justify-center @xl:w-36"
              disabled={busy}
              onClick={onReject}
            >
              <Undo2 className="size-4" aria-hidden /> Trả lại để sửa
            </Btn>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-[var(--line)] pt-3 text-[var(--fs-sm)] @xl:col-start-2 @xl:row-start-3 @xl:flex-row @xl:justify-end @xl:gap-4 @xl:border-t-0 @xl:pt-0">
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
          <DocChain
            links={[
              {
                label: l.order_codes.length > 1 ? 'Đơn hàng (gộp)' : 'Đơn hàng',
                code: l.order_codes.join(', ') || '—',
              },
              { label: 'LSX', code: l.code },
            ]}
          />
          <h1 className="mt-[6px] font-semibold tracking-[-.01em] text-[var(--fs-title)]">
            {l.customer_name}
          </h1>
          <div className="mt-[2px] text-[var(--fs-sm)] text-[var(--ink-3)]">
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
          <FlowSteps
            nowIso={nowIso}
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
          <DocChain links={[{ label: 'Báo giá', code: q.code }]} />
          <h1 className="mt-[6px] font-semibold tracking-[-.01em] text-[var(--fs-title)]">
            {q.customer_name}
          </h1>
          <div className="mt-[2px] text-[var(--fs-sm)] text-[var(--ink-3)]">
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
          <FlowSteps
            nowIso={nowIso}
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

/* ══════════════════════════════════════════════════════════════════════
   THÂN ĐƠN MUA — THIẾT KẾ LẠI 17/09/2026

   Bắt đầu từ NHIỆM VỤ, không từ khuôn. Giám đốc ngồi trước 15 phiếu, mỗi
   phiếu hỏi bốn câu theo đúng thứ tự này:

     1. bao nhiêu tiền, cho ai?       → dải quyết định, ngay trên đầu
     2. có gì bất thường không?       → dải cảnh báo, mỗi dải một việc
     3. dòng nào gây ra nó?           → lưới, cảnh báo trỏ thẳng vào dòng
     4. ký xong thì phiếu sau ở đâu?  → ‹n/N› + "Ký & sang phiếu sau"

   Câu 4 là thứ bản cũ bỏ sót hoàn toàn: ký xong `router.push` về danh sách,
   người ký phải tìm lại chỗ mình dừng. Với 15 phiếu đó là 15 lần quay đầu.

   BỐN KHÁC BIỆT so với bản cũ:
    · quyết định thành DẢI NGANG trên đầu, thay cột phải 340px vốn ăn chỗ của
      lưới và ở màn hẹp thì xếp chồng thành khối cao lêu nghêu;
    · cảnh báo tách thành từng dải RIÊNG, mỗi dải nói một việc và trỏ vào dòng
      gây ra nó — bản cũ gộp một câu "cần xem kỹ từng dòng" ở khay phải;
    · lưới vật tư MỘT bố cục, bắt đầu trong 1/3 màn đầu (tiêu chí 1 của
      `docs/tieu-chi-man-chung-tu-erp.md`);
    · khay phải chỉ để ĐỌC — không còn nút nào.
   ══════════════════════════════════════════════════════════════════════ */
function PoBody({
  p,
  nowIso,
  dec,
  nav,
}: {
  p: PendingPo
  nowIso: string
  dec: Dec
  nav?: ApprovalNav
}) {
  // `big` tính ở server theo TIỀN TỆ của đơn (approvals/data.ts). Trước
  // 17/08/2026 chỗ này gọi isBigApproval(p.total) — so mọi tiền tệ với ngưỡng
  // 50tr VND, nên đơn 3.000 USD hiện ra "sẵn sàng ký" đúng như bẫy mà ngưỡng
  // sinh ra để chặn.
  const big = p.big ?? false
  const noThreshold = p.threshold == null
  const days = waitingDays(p.created_at, nowIso)
  const due = dueBadge(daysUntil(p.expected_at, nowIso))
  const lines = p.lines ?? []
  const missingPrice = lines.filter((ln) => ln.unit_price == null).length

  /*
    DÒNG TĂNG GIÁ — đếm ở đây để dải cảnh báo nói được CON SỐ và TÊN, thay vì
    một câu chung. "1 dòng: Bồn hoa lớn (1.500 → 1.680)" chỉ thẳng chỗ phải
    nhìn; "cần xem kỹ từng dòng" thì bắt người ký tự dò 3 dòng hay 40 dòng.
  */
  const tangGia = lines
    .map((ln) => ({ ln, cmp: comparePrice(ln, p.last_prices, p.currency) }))
    .filter((x) => x.cmp != null && x.cmp.pct >= 5)

  type Canh = { tone: 'stop' | 'warn'; icon: typeof TriangleAlert; title: string; body: React.ReactNode; action?: { label: string; href: string } } // prettier-ignore
  const canhBao: Canh[] = []
  if (big) {
    canhBao.push({
      tone: 'stop',
      icon: TriangleAlert,
      title: noThreshold
        ? `Chưa đặt ngưỡng cho ${p.currency}`
        : `Giá trị lớn (≥ ${money(p.threshold!, p.currency)})`,
      body: noThreshold
        ? 'Mặc định coi là đơn lớn, phải đọc từng dòng trước khi duyệt chi.'
        : 'Cần xem kỹ từng dòng trước khi duyệt chi.',
      action: noThreshold
        ? { label: 'Đặt ngưỡng ở Luật ký', href: '/exec/luat-ky' }
        : undefined,
    })
  }
  if (tangGia.length > 0) {
    const d = tangGia[0]
    canhBao.push({
      tone: 'warn',
      icon: TrendingUp,
      title: `Giá cao hơn lần mua trước ${tangGia.length > 1 ? 'ở ' + tangGia.length + ' dòng' : Math.round(d.cmp!.pct) + '%'}`, // prettier-ignore
      body:
        tangGia.length === 1
          ? `${d.ln.material_name} — ${fmtVnd(d.cmp!.prev)} → ${fmtVnd(d.ln.unit_price!)} ${p.currency} (đơn ${d.cmp!.poCode}).`
          : `Cao nhất: ${d.ln.material_name} +${Math.round(d.cmp!.pct)}%. Các dòng tăng giá được tô nền ở lưới dưới.`,
    })
  }
  if (missingPrice > 0) {
    canhBao.push({
      tone: 'warn',
      icon: TriangleAlert,
      title: `${missingPrice} dòng chưa có đơn giá`,
      body: 'Tổng cam kết chi ở trên đang tính THIẾU đúng bằng những dòng đó.',
    })
  }
  if (due.tone === 'red') {
    canhBao.push({
      tone: 'warn',
      icon: Truck,
      title: `Hàng hẹn về ${fmtD(p.expected_at)} — ${due.text}`,
      body: 'Duyệt để Cung ứng kịp gửi đơn cho nhà cung cấp.',
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── DẢI 1: định vị + đi tuyến tính ‹n/N› ───────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--hair)] bg-[var(--surface-card)] px-[var(--gutter)] py-[5px]">
        <Btn href="/exec/approvals">
          <ChevronLeft className="size-4" aria-hidden />
          Chờ tôi phê duyệt
        </Btn>
        {nav && nav.total > 1 && (
          <span className="flex items-center gap-[2px]">
            <Btn
              href={nav.prevHref ?? undefined}
              disabled={!nav.prevHref}
              title={nav.prevHref ? 'Phiếu trước' : 'Đây là phiếu đầu'}
            >
              ‹
            </Btn>
            <span className="num px-[6px] text-[var(--fs-sm)] text-[var(--ink-2)]">
              {nav.index || '—'} / {nav.total}
            </span>
            <Btn
              href={nav.nextHref ?? undefined}
              disabled={!nav.nextHref}
              title={nav.nextHref ? 'Phiếu sau' : 'Đây là phiếu cuối'}
            >
              ›
            </Btn>
          </span>
        )}
        <span className="h-[16px] w-px bg-[var(--hair)]" />
        <DocChain
          links={[
            ...(p.order_code ? [{ label: 'Đơn hàng', code: p.order_code }] : []),
            ...(p.lsx_code ? [{ label: 'LSX', code: p.lsx_code }] : []),
            { label: 'Đơn vật tư', code: p.code },
          ]}
        />
        <span className="ml-auto flex gap-2">
          <Btn href={`/print/supply/${p.id}`}>
            <Printer className="size-4" aria-hidden />
            Bản in
          </Btn>
        </span>
      </div>

      {/* ── DẢI 2: QUYẾT ĐỊNH — ngang, luôn thấy ───────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-[var(--line)] bg-[var(--surface-hover)] px-[var(--gutter)] py-[9px]">
        <div className="min-w-0">
          <div className="font-semibold tracking-[.05em] text-[var(--fs-label)] text-[var(--ink-3)] uppercase">
            Đơn đặt vật tư · tổng cam kết chi
          </div>
          <div className="mt-[1px] flex flex-wrap items-baseline gap-[10px]">
            <span
              className={cn(
                'num text-[24px] leading-tight font-bold',
                big && 'text-[var(--stop)]',
              )}
            >
              {money(p.total, p.currency)}
            </span>
            <span className="font-semibold">{p.supplier_name}</span>
          </div>
        </div>

        {canhBao.length === 0 && (
          <span className="inline-flex items-center gap-[7px] rounded-[var(--radius)] bg-[var(--done-wash)] px-[10px] py-[5px] font-semibold text-[var(--done)] text-[var(--fs-sm)]">
            <ShieldCheck className="size-4" aria-hidden />
            Không có gì bất thường — dưới ngưỡng, đủ giá, đúng hẹn
          </span>
        )}

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Btn disabled={dec.busy} onClick={() => dec.askReject(targetPo(p))}>
            <Undo2 className="size-4" aria-hidden />
            Trả lại để sửa
          </Btn>
          <Btn primary disabled={dec.busy} onClick={() => dec.askApprove(targetPo(p))}>
            <ShieldCheck className="size-4" aria-hidden />
            Phê duyệt
          </Btn>
          {/*
            KÝ RỒI ĐI TIẾP — nút chỉ có nghĩa khi còn phiếu sau. Hết chồng thì
            biến mất chứ không khoá: người ký vừa xong việc, bày một nút xám
            "sang phiếu sau" là nói với họ rằng còn việc, trong khi không còn.
          */}
          {nav?.nextHref && (
            <Btn
              primary
              disabled={dec.busy}
              title="Ký phiếu này rồi mở luôn phiếu kế tiếp trong hộp"
              onClick={() => dec.askApprove(targetPo(p), nav.nextHref ?? undefined)}
            >
              Ký &amp; sang phiếu sau
              <ChevronRight className="size-4" aria-hidden />
            </Btn>
          )}
        </span>
      </div>

      {/* ── DẢI 3: VÌ SAO CẦN CHÚ Ý ────────────────────────────────────── */}
      {canhBao.length > 0 && (
        <div className="shrink-0 border-b border-[var(--line)]">
          {canhBao.map((c, i) => (
            <div
              key={i}
              className={cn(
                'flex flex-wrap items-center gap-[9px] px-[var(--gutter)] py-[6px] text-[var(--fs-sm)] text-[var(--ink-2)]',
                i > 0 && 'border-t border-[var(--hair)]',
                c.tone === 'stop' ? 'bg-[var(--stop-wash)]' : 'bg-[var(--warn-wash)]',
              )}
            >
              <c.icon
                className="size-[14px] shrink-0"
                style={{
                  color: c.tone === 'stop' ? 'var(--stop)' : 'var(--warn)',
                }}
                aria-hidden
              />
              <b
                style={{
                  color: c.tone === 'stop' ? 'var(--stop)' : 'var(--warn)',
                }}
              >
                {c.title}
              </b>
              <span>{c.body}</span>
              {c.action && (
                <span className="ml-auto">
                  <Btn href={c.action.href}>{c.action.label}</Btn>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── DẢI 4: LƯỚI VẬT TƯ + khay đọc ──────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[26px] shrink-0 items-center gap-[6px] border-b border-[var(--hair)] bg-[var(--surface-raised)] px-[var(--gutter)] font-bold tracking-[.08em] text-[var(--fs-label)] text-[var(--ink-label)] uppercase">
            <Package className="size-[14px]" aria-hidden />
            Dòng vật tư
            <span className="num ml-1 font-normal tracking-normal text-[var(--ink-3)] normal-case">
              {lines.length} dòng
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <PoLineTable
              lines={lines}
              total={p.total}
              currency={p.currency}
              lastPrices={p.last_prices}
            />
            {p.note && p.note.trim() && (
              <div className="flex items-start gap-2 border-t border-[var(--hair)] px-[var(--gutter)] py-[9px] text-[var(--fs-sm)] text-[var(--ink-2)]">
                <StickyNote
                  className="mt-[2px] size-[14px] shrink-0 text-[var(--ink-3)]"
                  aria-hidden
                />
                <span>
                  <b className="text-[var(--ink)]">Ghi chú đơn:</b>{' '}
                  <span className="whitespace-pre-wrap">{p.note}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/*
          KHAY CHỈ ĐỂ ĐỌC — mọi nút đã lên dải quyết định. Bản cũ để nút ở đây,
          nên ở màn hẹp khay xếp chồng và đẩy lưới xuống dưới nếp gấp.
        */}
        <aside className="hidden w-[300px] max-w-[300px] min-w-[300px] shrink-0 flex-col overflow-auto border-l border-[var(--line)] bg-[var(--surface-card)] xl:flex">
          <div className="border-b border-[var(--hair)] px-[12px] py-[10px]">
            <div className="mb-[7px] font-bold tracking-[.08em] text-[var(--fs-label)] text-[var(--ink-label)] uppercase">
              Số liệu chốt
            </div>
            <FactKv
              rows={[
                [
                  'Hàng hẹn về',
                  <span key="h" className={DUE_TEXT[due.tone]}>
                    {fmtD(p.expected_at)} · {due.text}
                  </span>,
                ],
                [
                  'Chờ duyệt',
                  <span key="c" className={days >= 4 ? DUE_TEXT.red : undefined}>
                    {days >= 1 ? `${days} ngày` : 'mới'}
                  </span>,
                ],
                ['Cho lệnh', p.lsx_code ?? 'Ngoài LSX'],
                ['Người lập', p.created_by_name ?? '— (nạp từ file)'],
                ['Lập ngày', fmtD(p.created_at)],
              ]}
            />
          </div>

          <div className="border-b border-[var(--hair)] px-[12px] py-[10px]">
            <FlowSteps
              nowIso={nowIso}
              steps={[
                {
                  label: 'Cung ứng lập đơn đặt',
                  iso: p.created_at,
                  /* Kit đã in ngày từ `iso`; ở đây chỉ còn NGƯỜI, không lặp lại ngày. */
                  date: p.created_by_name ?? '',
                },
                {
                  label: `Chờ Giám đốc duyệt${days >= 1 ? ` · ${days} ngày` : ''}`,
                  date: '',
                  now: true,
                },
                {
                  label: 'Cung ứng gửi đơn cho NCC (BR-05)',
                  date: 'Sau khi ký',
                  future: true,
                },
              ]}
            />
          </div>

          {/*
            LỆNH NÀY CÒN CHỜ GÌ — câu người ký hay hỏi mà màn cũ im lặng: ký tờ
            này rồi thì lệnh đó xong chưa, hay còn mấy tờ nữa nằm trong chồng.
          */}
          {p.lsx_code && nav && nav.sameLsxPending > 0 && (
            <div className="px-[12px] py-[10px]">
              <div className="mb-[7px] font-bold tracking-[.08em] text-[var(--fs-label)] text-[var(--ink-label)] uppercase">
                Lệnh này còn chờ gì
              </div>
              <p className="leading-relaxed text-[var(--fs-sm)] text-[var(--ink-2)]">
                Lệnh <b className="num text-[var(--ink)]">{p.lsx_code}</b> có{' '}
                <b className="text-[var(--ink)]">{nav.sameLsxPending} đơn</b> còn chờ chữ
                ký của bạn
                {nav.sameLsxPending > 1 ? ', kể cả đơn này' : ' — chính là đơn này'}.
              </p>
            </div>
          )}
        </aside>
      </div>

      <StatusBar
        left={[
          nav && nav.total > 0
            ? `Phiếu ${nav.index || '—'} / ${nav.total} đang chờ`
            : 'Phiếu chờ duyệt',
          canhBao.length > 0
            ? `${canhBao.length} việc cần chú ý`
            : 'Không có việc cần chú ý',
        ]}
        right={
          nav?.nextHref
            ? `Còn ${nav.total - nav.index} phiếu sau phiếu này`
            : 'Phiếu cuối trong hộp'
        }
      />
    </div>
  )
}
