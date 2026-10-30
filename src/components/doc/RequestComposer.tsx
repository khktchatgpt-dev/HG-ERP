'use client'

import { useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { dueBlock, type RequestDocType } from '@/lib/doc-requests'
import { PersonPicker } from './PersonPicker'
import { addDays, btn, fieldCls, labelCls, nextMonday, type Person } from './request-ui'

/**
 * Ô GIAO VIỆC trên chứng từ (0281, B2 — Bản vẽ 1 đã duyệt 29/10/2026): người nhận
 * (mọi phòng) + hạn (tuỳ chọn) + việc cần làm → "Giao việc".
 *
 * Nút bị chặn thì NÓI VƯỚNG GÌ ngay dưới nút, mỗi chỗ thiếu là một nút bấm nhảy
 * tới đúng ô — không cho bấm rồi mới báo lỗi. Hạn gõ dd/mm/yyyy (không dùng
 * `type="date"`: trình duyệt tiếng Anh vẽ mm/dd), cộng bốn nút hạn hay dùng.
 */
export function RequestComposer({
  docType,
  docId,
  people,
  peopleLoading,
  meId,
  today,
  onCreated,
}: {
  docType: RequestDocType
  docId: string
  people: Person[]
  peopleLoading: boolean
  meId: string
  /** Hôm nay (YYYY-MM-DD, giờ VN) — đọc một lần ở khối cha. */
  today: string
  onCreated: (assigneeName: string) => void
}) {
  const [assignee, setAssignee] = useState<string | null>(null)
  const [dueText, setDueText] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const personRef = useRef<HTMLInputElement>(null)
  const dueRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const dueIso = dueText.trim() ? vnToIso(dueText) : null
  const dueErr = dueText.trim()
    ? dueIso
      ? dueBlock(dueIso, today)
      : 'Hạn chưa đúng dạng dd/mm/yyyy'
    : null

  // Chỗ còn thiếu, theo thứ tự trên màn — câu chặn đọc từ trái sang phải như form.
  // Chỉ giữ TÊN ô; đọc ref để đưa con trỏ tới ô thì làm trong hàm bấm (`go`), không
  // trong lúc vẽ — React cấm chạm ref khi render.
  const missing: { label: string; field: 'person' | 'due' | 'body' }[] = [
    ...(!assignee ? [{ label: 'chọn người nhận', field: 'person' as const }] : []),
    ...(dueErr ? [{ label: dueErr.toLowerCase(), field: 'due' as const }] : []),
    ...(!body.trim() ? [{ label: 'ghi việc cần làm', field: 'body' as const }] : []),
  ]
  const blocked = missing.length > 0 || busy
  const who = people.find((p) => p.id === assignee)

  function go(field: 'person' | 'due' | 'body') {
    const el = { person: personRef, due: dueRef, body: bodyRef }[field].current
    el?.focus()
  }

  async function submit() {
    if (missing.length > 0) {
      go(missing[0].field)
      return
    }
    if (busy) return
    setBusy(true)
    setLoi(null)
    try {
      await api('/api/doc-requests', {
        method: 'POST',
        body: {
          doc_type: docType,
          doc_id: docId,
          assignee_id: assignee,
          due_on: dueIso,
          body,
        },
      })
      onCreated(who?.name ?? 'người nhận')
      setAssignee(null)
      setDueText('')
      setBody('')
    } catch (e) {
      // Giữ nguyên mọi ô — người dùng sửa chỗ sai rồi bấm lại, không gõ lại từ đầu.
      setLoi(apiErrorText(e, 'Chưa giao được — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  const quick: [string, string | null][] = [
    ['Hôm nay', today],
    ['Mai', addDays(today, 1)],
    ['Thứ Hai', nextMonday(today)],
    ['Không hạn', null],
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[minmax(0,1fr)_128px] gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={`${docId}-giao-cho`} className={labelCls}>
            Giao cho
          </label>
          <PersonPicker
            id={`${docId}-giao-cho`}
            people={people}
            loading={peopleLoading}
            value={assignee}
            onChange={setAssignee}
            meId={meId}
            inputRef={personRef}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${docId}-han`} className={labelCls}>
            Hạn
          </label>
          <input
            id={`${docId}-han`}
            ref={dueRef}
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            aria-invalid={!!dueErr}
            className={`${fieldCls} h-7 font-mono tabular-nums ${dueErr ? 'border-[var(--stop)]' : ''}`}
            value={dueText}
            onChange={(e) => setDueText(maskVnDate(e.target.value))}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Hạn nhanh">
        {quick.map(([label, iso]) => {
          const on = iso ? dueIso === iso : !dueText.trim()
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => setDueText(iso ? isoToVn(iso) : '')}
              className={`h-5 rounded-full border px-2 text-[11px] ${on ? 'border-[var(--act-line)] bg-[var(--act-wash)] font-semibold text-[var(--act-text)]' : 'border-[var(--hair)] text-[var(--ink-label)] hover:border-[var(--line)]'}`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${docId}-viec`} className={labelCls}>
          Việc cần làm
        </label>
        <textarea
          id={`${docId}-viec`}
          ref={bodyRef}
          rows={3}
          maxLength={2000}
          placeholder="Vd: Bổ sung ảnh SP cho các dòng còn trống — Cung ứng cần để đặt vật tư"
          className={`${fieldCls} resize-y py-1.5 leading-[1.45]`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              void submit()
            }
          }}
        />
      </div>
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[12px] leading-[1.45] text-[var(--ink-label)]">
          {/* Tự giao cho mình thì KHÔNG có chuông (không báo người vừa bấm) — câu nhắc
              không được hứa điều hệ thống không làm. */}
          {!who
            ? 'Người nhận thấy yêu cầu ghim ở đầu khối này và nhận chuông thông báo.'
            : who.id === meId
              ? 'Bạn tự giao cho mình — không có chuông; yêu cầu ghim ở đầu khối này.'
              : `${who.name} nhận chuông thông báo và thấy yêu cầu ghim ở đầu khối này.`}
        </p>
        <button
          type="button"
          aria-disabled={blocked}
          onClick={() => void submit()}
          className={btn('primary', blocked)}
        >
          <Send size={14} aria-hidden />
          {busy ? 'Đang giao…' : 'Giao việc'}
        </button>
      </div>
      {missing.length > 0 && (
        <p className="text-[12px] text-[var(--warn)]">
          Còn thiếu:{' '}
          {missing.map((m, i) => (
            <span key={m.label}>
              {i > 0 && ' · '}
              <button
                type="button"
                onClick={() => go(m.field)}
                className="underline underline-offset-2"
              >
                {m.label}
              </button>
            </span>
          ))}
        </p>
      )}
      {loi && (
        <p
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--stop-line)] bg-[var(--stop-wash)] px-2 py-1.5 text-[12px] text-[var(--stop)]"
        >
          {loi}
        </p>
      )}
    </div>
  )
}
