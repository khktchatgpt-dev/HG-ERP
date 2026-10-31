'use client'

import { useImperativeHandle, useRef, useState } from 'react'
import { Flag, Send, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { dueEndOfDay } from '@/lib/task-flow'
import type { Assignee } from '@/modules/workflow/tasks/tasks.service'
import { ChonNguoi } from './chon-nguoi'
import { addDays, btn, fieldCls, labelCls, nextMonday } from './phan-cong.shared'

export type GiaoViecHandle = { focus: () => void }

/**
 * HỘP GIAO VIỆC (bản vẽ 1, P2 — 30/10/2026): người nhận (mọi phòng) · việc cần làm
 * · chi tiết (tuỳ chọn) · hạn · Gấp.
 *
 * Nút bị chặn thì NÓI VƯỚNG GÌ ngay dưới nút, mỗi chỗ thiếu là một nút bấm nhảy
 * tới đúng ô. Hạn gõ dd/mm/yyyy (không `type="date"`: trình duyệt tiếng Anh vẽ
 * mm/dd) cộng bốn nút hạn hay dùng; lưu là mốc HẾT NGÀY đó giờ VN.
 */
export function GiaoViec({
  people,
  meId,
  today,
  onDone,
  onClose,
  ref,
}: {
  people: Assignee[]
  meId: string
  /** Hôm nay (YYYY-MM-DD, giờ VN) — đọc một lần ở màn cha. */
  today: string
  onDone: (assigneeName: string) => void
  /** Có thì hiện nút đóng cạnh tiêu đề — hộp mở bên phải Bàn làm việc (P4). */
  onClose?: () => void
  /** React 19: ref là prop thường — màn cha gọi `focus()` khi bấm "Giao việc" ở đầu trang. */
  ref?: React.Ref<GiaoViecHandle>
}) {
  const [assignee, setAssignee] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [dueText, setDueText] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const personRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dueRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({ focus: () => personRef.current?.focus() }))

  const dueIso = dueText.trim() ? vnToIso(dueText) : null
  const dueErr = !dueText.trim()
    ? null
    : !dueIso
      ? 'hạn chưa đúng dạng dd/mm/yyyy'
      : dueIso < today
        ? 'hạn đã qua'
        : null

  // Chỉ giữ TÊN ô; đọc ref để nhảy tới ô thì làm trong hàm bấm, không lúc vẽ.
  const missing: { label: string; field: 'person' | 'title' | 'due' }[] = [
    ...(!assignee ? [{ label: 'chọn người nhận', field: 'person' as const }] : []),
    ...(!title.trim() ? [{ label: 'ghi việc cần làm', field: 'title' as const }] : []),
    ...(dueErr ? [{ label: dueErr, field: 'due' as const }] : []),
  ]
  const blocked = missing.length > 0 || busy
  const who = people.find((p) => p.id === assignee)

  function go(field: 'person' | 'title' | 'due') {
    ;({ person: personRef, title: titleRef, due: dueRef })[field].current?.focus()
  }

  async function submit() {
    if (missing.length > 0) return go(missing[0].field)
    if (busy) return
    setBusy(true)
    setLoi(null)
    try {
      await api('/api/tasks', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: detail.trim() || null,
          assignee_id: assignee,
          due_date: dueIso ? dueEndOfDay(dueIso) : null,
          priority: urgent ? 'urgent' : 'normal',
        },
      })
      onDone(who?.name ?? 'người nhận')
      setAssignee(null)
      setTitle('')
      setDetail('')
      setDueText('')
      setUrgent(false)
    } catch (e) {
      // Giữ nguyên mọi ô — sửa chỗ sai rồi bấm lại, không gõ lại từ đầu.
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
    <form
      aria-label="Giao việc"
      className="flex flex-col gap-2.5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void submit()
        }
      }}
    >
      <div className="flex items-center gap-2">
        <h2 className="flex-1 text-[15px] font-semibold text-[var(--foreground)]">
          Giao việc
        </h2>
        {onClose && (
          <button
            type="button"
            aria-label="Đóng hộp giao việc"
            className={btn('ghost', false, true)}
            onClick={onClose}
          >
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pcv-nguoi" className={labelCls}>
          Người nhận
        </label>
        <ChonNguoi
          id="pcv-nguoi"
          people={people}
          value={assignee}
          onChange={setAssignee}
          meId={meId}
          exclude={[meId]}
          inputRef={personRef}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pcv-viec" className={labelCls}>
          Việc cần làm
        </label>
        <input
          id="pcv-viec"
          ref={titleRef}
          maxLength={200}
          className={`${fieldCls} h-7`}
          placeholder="Vd: Bổ sung ảnh SP cho lệnh 01/26-27 - LAURA"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pcv-chitiet" className={labelCls}>
          Chi tiết{' '}
          <span className="font-normal tracking-normal normal-case">(tuỳ chọn)</span>
        </label>
        <textarea
          id="pcv-chitiet"
          rows={3}
          maxLength={5000}
          className={`${fieldCls} resize-y py-1.5 leading-[1.45]`}
          placeholder="Cần gì, gửi cho ai, lấy số ở đâu…"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="pcv-han" className={labelCls}>
            Hạn
          </label>
          <input
            id="pcv-han"
            ref={dueRef}
            inputMode="numeric"
            placeholder="dd/mm/yyyy"
            aria-invalid={!!dueErr}
            className={`${fieldCls} h-7 font-mono tabular-nums ${dueErr ? 'border-[var(--stop)]' : ''}`}
            value={dueText}
            onChange={(e) => setDueText(maskVnDate(e.target.value))}
          />
        </div>
        <button
          type="button"
          aria-pressed={urgent}
          onClick={() => setUrgent((u) => !u)}
          className={`${btn('normal')} ${urgent ? 'border-[var(--stop)] text-[var(--stop)]' : ''}`}
        >
          <Flag size={14} aria-hidden />
          Gấp
        </button>
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
              className={`h-5 rounded-full border px-2 text-[11px] ${on ? 'border-[var(--primary)]/40 bg-[var(--accent)] font-semibold text-[var(--accent-foreground)]' : 'border-[var(--border)] text-[var(--muted-foreground)] hover:border-[var(--input)]'}`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="flex items-start gap-2 pt-1">
        <p className="min-w-0 flex-1 text-[12px] leading-[1.45] text-[var(--muted-foreground)]">
          {who
            ? `${who.name} nhận chuông thông báo ngay khi giao.`
            : 'Người nhận nhận chuông thông báo ngay khi giao.'}
        </p>
        <button type="submit" aria-disabled={blocked} className={btn('primary', blocked)}>
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
          className="rounded-md border border-[var(--stop)]/30 bg-[var(--stop)]/10 px-2 py-1.5 text-[12px] text-[var(--stop)]"
        >
          {loi}
        </p>
      )}
    </form>
  )
}
