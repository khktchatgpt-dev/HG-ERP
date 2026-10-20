'use client'

import { Btn, Ico } from '@/components/kit'
import { cn } from '@/lib/utils'
import {
  canUnapprove,
  questionKindFor,
  QUESTION_LABEL,
  signModeFor,
  type SignMode,
  type PoQuestionThread,
} from '@/lib/po-signature'
import { fmtD, fmtVnd } from './approval-parts'
import type { FollowUpAsk, useApprovalDecision } from './useApprovalDecision'
import type { PendingPo } from './approval-types'

type Dec = ReturnType<typeof useApprovalDecision>

/* ══════════════════════════════════════════════════════════════════════
   MÀN KÝ SAU CHỮ KÝ (0218, chủ dự án chốt 01/10/2026)

   Màn ký mở được đơn ở MỌI trạng thái. Đầu màn đổi theo đơn đang ở đâu:

     decide   — chờ duyệt: dải quyết định (Hỏi lại · Trả lại · Phê duyệt)
     late     — đã GỬI GẤP, chưa ký: lý do gấp + Ký bù / Không đồng ý
     signed   — đã ký, CHƯA gửi NCC: chữ ký + Thu hồi chữ ký
     sent     — đã gửi NCC: chữ ký + Yêu cầu xem lại (không thu hồi được nữa)
     received — hàng đã về đủ: chỉ còn điều chỉnh / trả hàng bên Kho
     draft / cancelled — chỉ đọc, nói vì sao không có gì để làm

   Không thêm trạng thái đơn — mọi chế độ suy từ trạng thái + dấu ký có sẵn.
   ══════════════════════════════════════════════════════════════════════ */
export type { SignMode }

/** Chế độ đầu màn từ dữ liệu màn ký — luật ở `lib/po-signature.signModeFor`. */
export function signModeOf(p: PendingPo): SignMode {
  return signModeFor({
    status: p.status ?? 'pending_approval',
    urgent_sent_at: p.urgent?.at ?? null,
    approved_at: p.approved_at ?? null,
  })
}

function fmtDT(iso: string) {
  const d = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** Hỏi lại (chưa quyết) / Yêu cầu xem lại (đã ký, đã gửi) — cùng một đường. */
export function questionAsk(
  p: PendingPo,
  opts?: { disagree?: boolean },
): FollowUpAsk | null {
  const kind = questionKindFor({
    status: p.status ?? 'pending_approval',
    urgent_sent_at: p.urgent?.at ?? null,
    approved_at: p.approved_at ?? null,
  })
  if (!kind) return null
  const who = p.owner_name ?? 'người phụ trách'
  return {
    title: opts?.disagree
      ? `Không đồng ý đơn gửi gấp ${p.code}?`
      : `${QUESTION_LABEL[kind]} — ${p.code}`,
    consequence:
      kind === 'ask'
        ? `Câu hỏi gửi tới ${who}. Đơn KHÔNG đổi trạng thái, vẫn nằm trong hộp ký với nhãn "đang hỏi"; ${who} trả lời thì bạn nhận thông báo. Ký hoặc trả lại lúc nào cũng được.`
        : `Đơn đã ký${p.ordered_at ? ' và đã gửi nhà cung cấp' : ''} nên không đổi trạng thái. ${who} nhận yêu cầu, xử lý bằng "Điều chỉnh đơn" hoặc "Huỷ đơn" rồi trả lời bạn.`,
    text: {
      label: opts?.disagree
        ? 'Vì sao không đồng ý, cần Cung ứng làm gì'
        : 'Câu hỏi / yêu cầu',
      placeholder:
        kind === 'ask'
          ? 'Ví dụ: Giá nệm bank 1 sao cao hơn lần trước? Đã hỏi nơi khác chưa?'
          : 'Ví dụ: Hẹn về đã qua, hàng về chưa? Chưa về thì báo lý do hoặc huỷ phần còn lại.',
      field: 'body',
      min: 5,
    },
    confirm: opts?.disagree ? 'Gửi yêu cầu xem lại' : 'Gửi câu hỏi',
    path: `/api/dept/supply/pos/${p.id}/questions`,
    done: 'Đã gửi tới người phụ trách',
  }
}

function unapproveAsk(p: PendingPo): FollowUpAsk {
  return {
    title: `Thu hồi chữ ký trên ${p.code}?`,
    consequence: `Đơn quay về CHỜ DUYỆT (không về nháp). Nút "Gửi NCC" bên Mua hàng khoá ngay. ${p.owner_name ?? 'Người phụ trách'} nhận thông báo kèm lý do. Ký lại lúc nào cũng được.`,
    text: {
      label: 'Lý do (bắt buộc, người phụ trách sẽ đọc)',
      placeholder:
        'Ví dụ: Bấm nhầm. Chưa có điều khoản thanh toán — bổ sung rồi trình lại.',
      field: 'reason',
      min: 5,
    },
    confirm: 'Thu hồi chữ ký',
    path: `/api/dept/supply/pos/${p.id}/unapprove`,
    done: 'Đã thu hồi chữ ký — đơn về chờ duyệt',
  }
}

function signLateAsk(p: PendingPo): FollowUpAsk {
  return {
    title: `Ký bù ${p.code}?`,
    consequence: `Đơn đã gửi nhà cung cấp lúc ${p.urgent ? fmtDT(p.urgent.at) : '—'}. Ký bù chỉ gắn chữ ký — trạng thái đơn giữ nguyên.`,
    confirm: 'Ký bù',
    path: `/api/dept/supply/pos/${p.id}/sign-late`,
    done: 'Đã ký bù',
  }
}

/**
 * DẢI CHỮ KÝ — thay dải quyết định khi đơn không còn chờ duyệt. Nói đơn đang ở
 * đâu, ai đã ký, và việc còn làm được với chữ ký đó. Nút bị chặn thì nói vì
 * sao ngay tại dải (luật kit: không cho bấm rồi mới báo lỗi).
 */
export function SignatureBand({
  p,
  dec,
  mode,
}: {
  p: PendingPo
  dec: Dec
  mode: SignMode
}) {
  if (mode === 'decide') return null
  const signedBy = p.approved_by_name ?? 'không rõ người ký'
  const signed = p.approved_at ? (
    <span>
      <b className="text-[var(--done)]">
        <Ico name="xong" size={13} className="mr-1 inline" aria-hidden />
        {p.urgent ? 'Đã ký bù' : 'Đã duyệt'}
      </b>{' '}
      · {signedBy} · <span className="num">{fmtDT(p.approved_at)}</span>
    </span>
  ) : (
    <span className="text-[var(--ink-3)]">
      Không có chữ ký trên hệ thống (đơn nạp từ file)
    </span>
  )
  const sentAt = p.ordered_at ? (
    <span>
      · Đã gửi NCC <span className="num">{fmtDT(p.ordered_at)}</span>
    </span>
  ) : null
  const ask = questionAsk(p)
  const unapprove = canUnapprove({
    status: p.status ?? '',
    receiptDocs: p.receipt_docs ?? 0,
  })

  const shell = (
    tone: 'done' | 'stop' | 'raised',
    body: React.ReactNode,
    actions?: React.ReactNode,
  ) =>
    // prettier-ignore
    <div
      className={cn(
        'text-k-sm flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--line)] px-[var(--gutter)] py-2',
        tone === 'done' && 'bg-[var(--done-wash)]',
        tone === 'stop' && 'bg-[var(--stop-wash)]',
        tone === 'raised' && 'bg-[var(--surface-raised)]',
      )}
    >
      {body}
      {actions && <span className="ml-auto flex flex-wrap items-center gap-2">{actions}</span>}
    </div>

  if (mode === 'late') {
    const disagree = questionAsk(p, { disagree: true })
    return shell(
      'stop',
      <span>
        <b className="text-[var(--stop)]">
          <Ico name="canhBao" size={13} className="mr-1 inline" aria-hidden />
          Đã gửi NCC trước khi ký
        </b>{' '}
        · {p.urgent?.by_name ?? 'trưởng phòng Cung ứng'} ·{' '}
        <span className="num">{p.urgent ? fmtDT(p.urgent.at) : '—'}</span>
        {p.urgent?.reason && (
          <span className="block text-[var(--ink-2)]">
            Lý do gấp: <b className="text-[var(--ink)]">{p.urgent.reason}</b>
          </span>
        )}
      </span>,
      <>
        {disagree && (
          <Btn
            disabled={dec.busy}
            icon="traLai"
            onClick={() => dec.askFollowUp(disagree)}
          >
            Không đồng ý · yêu cầu xem lại
          </Btn>
        )}
        <Btn
          primary
          disabled={dec.busy}
          icon="duyet"
          onClick={() => dec.askFollowUp(signLateAsk(p))}
        >
          Ký bù
        </Btn>
      </>,
    )
  }

  if (mode === 'signed') {
    return shell(
      'done',
      <>
        {signed}
        <span className="text-[var(--ink-2)]">
          · Cung ứng chưa gửi NCC — còn thu hồi được
        </span>
      </>,
      unapprove.ok ? (
        <Btn
          disabled={dec.busy}
          icon="traLai"
          onClick={() => dec.askFollowUp(unapproveAsk(p))}
        >
          Thu hồi chữ ký
        </Btn>
      ) : (
        <span className="text-k-label text-[var(--warn)]">{unapprove.reason}</span>
      ),
    )
  }

  if (mode === 'sent' || mode === 'received') {
    return shell(
      'raised',
      <>
        {signed}
        {sentAt}
        <span className="basis-full text-[var(--ink-2)]">
          {mode === 'received'
            ? 'Hàng đã về đủ — chỉ còn điều chỉnh hoặc trả hàng bên Kho.'
            : 'Nhà cung cấp đang cầm bản này nên không thu hồi chữ ký được. Muốn sửa: yêu cầu Cung ứng điều chỉnh hoặc huỷ đơn.'}
          {p.adjusted_after_sign && (
            <b className="ml-1 text-[var(--warn)]">
              Đã điều chỉnh {p.adjusted_after_sign.count} lần sau khi ký ·{' '}
              {p.adjusted_after_sign.delta >= 0 ? '+' : '−'}
              {fmtVnd(Math.abs(p.adjusted_after_sign.delta))} {p.currency}
            </b>
          )}
        </span>
      </>,
      ask && (
        <Btn disabled={dec.busy} icon="ghiChu" onClick={() => dec.askFollowUp(ask)}>
          Yêu cầu xem lại
        </Btn>
      ),
    )
  }

  return shell(
    'raised',
    <span className="text-[var(--ink-2)]">
      {mode === 'draft'
        ? 'Đơn đang ở NHÁP — Cung ứng đang soạn hoặc sửa, chưa tới bàn ký.'
        : 'Đơn đã huỷ — không còn việc gì với chữ ký.'}
    </span>,
  )
}

/**
 * CÂU HỎI CỦA GIÁM ĐỐC trên đơn — câu còn mở trước, kèm ai đang giữ bóng và
 * đã bao lâu; câu đã trả lời bày câu trả lời ngay dưới.
 */
export function QuestionThreads({
  qs,
  ownerName,
  nowIso,
}: {
  qs: PoQuestionThread[]
  ownerName: string | null
  nowIso: string
}) {
  if (qs.length === 0) return null
  const open = qs.filter((q) => !q.resolved_at)
  const shown = [...open, ...qs.filter((q) => q.resolved_at)].slice(0, 4)
  return (
    <div className="border-b border-[var(--line)]">
      {shown.map((q, i) => (
        <div
          key={q.id}
          className={cn(
            'text-k-sm grid gap-1 px-[var(--gutter)] py-1.5 text-[var(--ink-2)]',
            i > 0 && 'border-t border-[var(--hair)]',
            !q.resolved_at ? 'bg-[var(--act-wash)]' : 'bg-[var(--surface-card)]',
          )}
        >
          <span className="flex flex-wrap items-baseline gap-x-2">
            <b className="text-[var(--act-text)]">
              {QUESTION_LABEL[q.kind]} · {q.author_name ?? 'Giám đốc'} ·{' '}
              <span className="num">{fmtDT(q.created_at)}</span>
            </b>
            <span className="text-[var(--ink)]">{q.body}</span>
            {!q.resolved_at ? (
              <span className="text-k-label ml-auto font-semibold text-[var(--act-text)]">
                Chờ {ownerName ?? 'người phụ trách'} trả lời ·{' '}
                {waitText(q.created_at, nowIso)}
              </span>
            ) : (
              <span className="text-k-label ml-auto text-[var(--ink-3)]">
                {q.resolved_how === 'answered'
                  ? 'Đã trả lời'
                  : q.resolved_how === 'decided'
                    ? 'Đóng — đơn đã được quyết'
                    : 'Đóng — đơn đã thu hồi / huỷ'}
              </span>
            )}
          </span>
          {q.answers.map((a) => (
            <span key={a.id} className="pl-4">
              <b className="text-[var(--ink)]">{a.author_name ?? 'Cung ứng'}</b>{' '}
              <span className="num text-[var(--ink-3)]">· {fmtD(a.created_at)}</span>:{' '}
              <span className="whitespace-pre-wrap">{a.body}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

function waitText(fromIso: string, nowIso: string) {
  const h = Math.max(
    0,
    Math.floor((Date.parse(nowIso) - Date.parse(fromIso)) / 3_600_000),
  )
  return h < 24 ? `${h} giờ` : `${Math.floor(h / 24)} ngày`
}
