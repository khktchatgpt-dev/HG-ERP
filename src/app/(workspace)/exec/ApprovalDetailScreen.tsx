'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Btn, DocChain, Ico, ScreenFrame, Timeline } from '@/components/kit'
import { cn } from '@/lib/utils'
import { money, moneyByCurrency, waitingDays } from './approval-helpers'
import { useApprovalDecision, targetLsx, targetQuote } from './useApprovalDecision'
import {
  daysUntil,
  dueBadge,
  DUE_TEXT,
  Fact,
  fmtD,
  LsxProductTable,
  OrderInfo,
  SectionLabel,
  Signal,
  type DueTone,
} from './approval-parts'
import type { ApprovalNav, PendingLsx, PendingPo, PendingQuote } from './approval-types'
import { PoApprovalBody } from './po-approval'

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
        <PoApprovalBody p={props.item} nowIso={props.nowIso} dec={dec} nav={props.nav} />
        {dec.dialogs}
      </ScreenFrame>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/exec/approvals"
        className="text-k-sm -ml-1 inline-flex w-fit items-center gap-1 text-[var(--ink-3)] hover:text-[var(--ink)]"
      >
        <Ico name="quayLai" /> Chờ tôi phê duyệt
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
    <section className="border-b border-[var(--line)] bg-[var(--surface-card)] px-[var(--gutter)] py-3">
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
          <div className="text-k-sm flex flex-wrap items-center gap-x-2 text-[var(--ink-3)]">
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
            <span className="text-k-label text-[var(--ink-3)]">{metricLabel}</span>
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
                <dt className="text-k-label text-[var(--ink-3)]">{s.label}</dt>
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
              icon="duyet"
            >
              Phê duyệt
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
              icon="traLai"
            >
              Trả lại để sửa
            </Btn>
          </div>

          <div className="text-k-sm flex flex-col gap-1.5 border-t border-[var(--line)] pt-3 @xl:col-start-2 @xl:row-start-3 @xl:flex-row @xl:justify-end @xl:gap-4 @xl:border-t-0 @xl:pt-0">
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
          <h1 className="text-k-title mt-1.5 font-semibold tracking-[-.01em]">
            {l.customer_name}
          </h1>
          <div className="text-k-sm mt-0.5 text-[var(--ink-3)]">
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
                  <Ico name="hen" size={14} className="shrink-0" />
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
                    <Ico name="ghiChu" size={14} /> Ghi chú
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
              <Ico name="in" size={14} className="mr-1 inline" /> Bản in LSX
            </QuickLink>
            <Link
              href={`/exec/lsx/${l.id}`}
              className="text-[var(--primary)] hover:underline"
            >
              <Ico name="lenh" size={14} className="mr-1 inline" /> Hồ sơ sản xuất đầy đủ
              →
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
          <h1 className="text-k-title mt-1.5 font-semibold tracking-[-.01em]">
            {q.customer_name}
          </h1>
          <div className="text-k-sm mt-0.5 text-[var(--ink-3)]">
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
                    <Ico name="ghiChu" size={14} /> Ghi chú
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
            <Ico name="in" size={14} className="mr-1 inline" /> Bản in báo giá
          </QuickLink>
        }
      />
    </>
  )
}
