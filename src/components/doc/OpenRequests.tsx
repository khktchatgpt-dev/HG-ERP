'use client'

import { useState } from 'react'
import { ArrowRightLeft, Check, RotateCcw, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import type { DocNote } from '@/lib/doc-notes'
import { matchesFilter, requestState, type RequestAction } from '@/lib/doc-requests'
import type { RequestListItem } from '@/modules/core/doc-notes/doc-requests.service'
import { PersonPicker } from './PersonPicker'
import { btn, DueTag, fieldCls, type Person } from './request-ui'

/**
 * KHỐI "YÊU CẦU ĐANG MỞ" ghim đầu phần trao đổi của chứng từ (0281, B2).
 *
 * Nút trên mỗi yêu cầu là `actions` SERVER trả về (`allowedActions` với quyền
 * thật, kể cả admin) — màn hình không tự đoán luật. Mỗi bước mở một ô nhỏ ngay
 * dưới yêu cầu: báo xong / huỷ / mở lại bắt một câu (C4), chuyển thì chọn người.
 *
 * Yêu cầu XONG trong 7 ngày vẫn hiện (mờ hơn) kèm câu kết quả, để người giao đọc
 * và mở lại được ngay tại chỗ; huỷ / đóng thì chỉ còn trong dòng trao đổi.
 */

type Step = RequestAction

const STEP: Record<
  Step,
  { verb: string; field: string; placeholder: string; need: string }
> = {
  done: { verb: 'Báo xong', field: 'Kết quả', placeholder: 'Đã làm gì, còn gì chưa xong…', need: 'Ghi một câu kết quả để người giao biết đã làm gì' }, // prettier-ignore
  cancel: { verb: 'Huỷ yêu cầu', field: 'Lý do huỷ', placeholder: 'Vì sao không cần làm nữa…', need: 'Ghi lý do huỷ' }, // prettier-ignore
  reopen: { verb: 'Mở lại', field: 'Lý do mở lại', placeholder: 'Còn thiếu gì…', need: 'Ghi lý do mở lại' }, // prettier-ignore
  reassign: { verb: 'Chuyển', field: 'Lời nhắn (tuỳ chọn)', placeholder: 'Vd: Phương nghỉ phép', need: 'Chọn người nhận mới' }, // prettier-ignore
}

export function OpenRequests({
  requests,
  notes,
  people,
  peopleLoading,
  needPeople,
  meId,
  today,
  onChanged,
}: {
  requests: RequestListItem[]
  notes: DocNote[]
  people: Person[]
  peopleLoading: boolean
  /** Gọi khi mở ô "Chuyển" — danh sách người chỉ tải khi cần. */
  needPeople: () => void
  meId: string
  today: string
  onChanged: () => void
}) {
  const [step, setStep] = useState<{ id: string; kind: Step } | null>(null)
  const [text, setText] = useState('')
  const [to, setTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  // Ghi xong → khung cha tải lại (1–2 giây). Trong lúc đó yêu cầu vừa bấm hiện
  // "Đang cập nhật…" thay vì nút cũ, kẻo bấm lần hai và ăn lỗi "đã xong rồi". Hết
  // chờ khi danh sách mới về: so CHÍNH mảng `requests` lúc bấm, không cần effect.
  const [waiting, setWaiting] = useState<{ id: string; seen: RequestListItem[] } | null>(
    null,
  )

  const open = requests.filter((r) => requestState(r) === 'open')
  const recentDone = requests.filter((r) => matchesFilter(r, 'done', today))
  if (open.length === 0 && recentDone.length === 0) return null

  /** Câu kết quả mới nhất ("Xong: …") — vết báo xong là ghi chú trả lời yêu cầu. */
  const resultOf = (id: string) =>
    notes
      .filter((n) => n.reply_to === id && !n.deleted_at && n.body.startsWith('Xong: '))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
      ?.body.slice('Xong: '.length) ?? null

  function start(id: string, kind: Step) {
    setStep({ id, kind })
    setText('')
    setTo(null)
    setLoi(null)
    if (kind === 'reassign') needPeople()
  }

  async function send() {
    if (!step) return
    const s = STEP[step.kind]
    const missing = step.kind === 'reassign' ? !to : !text.trim()
    if (missing || busy) {
      if (missing) setLoi(s.need)
      return
    }
    setBusy(true)
    setLoi(null)
    try {
      await api(`/api/doc-requests/${step.id}`, {
        method: 'POST',
        body:
          step.kind === 'reassign'
            ? { action: 'reassign', assignee_id: to, text: text.trim() || undefined }
            : { action: step.kind, text },
      })
      setWaiting({ id: step.id, seen: requests })
      setStep(null)
      onChanged()
    } catch (e) {
      setLoi(apiErrorText(e, 'Chưa ghi được — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  function item(r: RequestListItem, faded: boolean) {
    const mine = r.assignee_id === meId
    const result = faded ? resultOf(r.id) : null
    const cur = step?.id === r.id ? step : null
    const s = cur ? STEP[cur.kind] : null
    const formMissing = cur ? (cur.kind === 'reassign' ? !to : !text.trim()) : false
    const isWaiting = waiting?.id === r.id && waiting.seen === requests

    return (
      <li
        key={r.id}
        className={`flex flex-col gap-1 border-t border-[var(--hair)] px-3 py-2 ${faded ? 'bg-[var(--surface-raised)]' : 'bg-[var(--surface-card)]'}`}
      >
        <p
          className={`text-[13px] leading-[1.45] font-semibold break-words ${faded ? 'text-[var(--ink-label)]' : 'text-[var(--ink)]'}`}
        >
          {r.body}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--ink-label)]">
          <span>
            {r.author_id === meId ? 'Bạn' : (r.author_name ?? 'Ai đó')} →{' '}
            <span className={mine ? 'font-semibold text-[var(--ink)]' : ''}>
              {mine ? 'bạn' : (r.assignee_name ?? 'người nhận')}
            </span>
          </span>
          {faded ? (
            <span className="inline-flex h-5 items-center rounded-[var(--radius-sm)] border border-[var(--done-line)] bg-[var(--done-wash)] px-1.5 font-medium text-[var(--done)]">
              Đã xong
            </span>
          ) : (
            <DueTag dueOn={r.due_on} overdueDays={r.overdue_days} />
          )}
        </div>
        {result && <p className="text-[12px] text-[var(--ink-label)]">“{result}”</p>}

        {isWaiting && (
          <p role="status" className="pt-0.5 text-[12px] text-[var(--ink-3)]">
            Đã ghi — đang cập nhật…
          </p>
        )}
        {!cur && !isWaiting && r.actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {r.actions.includes('done') && (
              <button
                type="button"
                className={btn(mine ? 'primary' : 'normal')}
                onClick={() => start(r.id, 'done')}
              >
                <Check size={14} aria-hidden />
                {mine ? 'Báo xong' : 'Báo xong thay'}
              </button>
            )}
            {r.actions.includes('reopen') && (
              <button
                type="button"
                className={btn('normal')}
                onClick={() => start(r.id, 'reopen')}
              >
                <RotateCcw size={14} aria-hidden />
                Mở lại
              </button>
            )}
            {r.actions.includes('reassign') && (
              <button
                type="button"
                className={btn('ghost')}
                onClick={() => start(r.id, 'reassign')}
              >
                <ArrowRightLeft size={14} aria-hidden />
                Chuyển
              </button>
            )}
            {r.actions.includes('cancel') && (
              <button
                type="button"
                className={btn('ghost')}
                onClick={() => start(r.id, 'cancel')}
              >
                <X size={14} aria-hidden />
                Huỷ
              </button>
            )}
          </div>
        )}

        {cur && s && (
          <div className="mt-1 flex flex-col gap-1.5 rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] p-2">
            {cur.kind === 'reassign' && (
              <PersonPicker
                id={`${r.id}-to`}
                people={people}
                loading={peopleLoading}
                value={to}
                onChange={setTo}
                meId={meId}
                exclude={[r.assignee_id]}
                placeholder="Chuyển cho ai…"
              />
            )}
            <label htmlFor={`${r.id}-text`} className="sr-only">
              {s.field}
            </label>
            <textarea
              id={`${r.id}-text`}
              rows={2}
              maxLength={2000}
              autoFocus={cur.kind !== 'reassign'}
              placeholder={`${s.field}: ${s.placeholder}`}
              className={`${fieldCls} resize-y py-1.5 leading-[1.45]`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void send()
                }
                if (e.key === 'Escape') setStep(null)
              }}
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-disabled={formMissing || busy}
                className={btn(
                  cur.kind === 'cancel' ? 'normal' : 'primary',
                  formMissing || busy,
                )}
                onClick={() => void send()}
              >
                {busy ? 'Đang ghi…' : s.verb}
              </button>
              <button
                type="button"
                className={btn('ghost')}
                onClick={() => setStep(null)}
              >
                Thôi
              </button>
            </div>
            {(formMissing || loi) && (
              <p
                role={loi ? 'alert' : undefined}
                className={`text-[12px] ${loi && !formMissing ? 'text-[var(--stop)]' : 'text-[var(--warn)]'}`}
              >
                {formMissing ? s.need : loi}
              </p>
            )}
          </div>
        )}
      </li>
    )
  }

  return (
    <section
      aria-label="Yêu cầu việc trên chứng từ"
      className="overflow-hidden rounded-[var(--radius)] border border-[var(--line)]"
    >
      <h3 className="bg-[var(--surface-raised)] px-3 py-1.5 text-[11px] font-semibold tracking-[0.05em] text-[var(--ink-label)] uppercase">
        Yêu cầu đang mở · <span className="font-mono tabular-nums">{open.length}</span>
        {recentDone.length > 0 && (
          <span className="font-normal tracking-normal normal-case">
            {' '}
            · {recentDone.length} vừa xong
          </span>
        )}
      </h3>
      <ul>
        {open.map((r) => item(r, false))}
        {recentDone.map((r) => item(r, true))}
      </ul>
    </section>
  )
}
