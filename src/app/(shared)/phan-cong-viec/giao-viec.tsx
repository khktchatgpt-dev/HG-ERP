'use client'

import { useImperativeHandle, useRef, useState } from 'react'
import { Flag, Paperclip, Send, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { formatBytes } from '@/lib/file-limits'
import { pickTaskFiles, isImageMime } from '@/lib/task-files'
import { dueEndOfDay, MAX_TASK_FILES } from '@/lib/task-flow'
import { uploadFileTracked } from '@/lib/upload'
import type { Assignee } from '@/modules/workflow/tasks/tasks.service'
import { ChonNguoi } from './chon-nguoi'
import { addDays, btn, fieldCls, labelCls, nextMonday } from './phan-cong.shared'

export type GiaoViecHandle = { focus: () => void }

/**
 * HỘP GIAO VIỆC (bản vẽ 1, P2 — 30/10/2026): người nhận (mọi phòng) · việc cần làm
 * · mô tả (tuỳ chọn) · hạn · tệp đính kèm · Gấp. Bản vẽ 2 (B3, 03/11/2026) thêm tệp
 * và gợi ý quyền của Bán Hàng. Tệp lên SAU khi việc đã tạo; tệp lỗi không làm mất việc.
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
  onOpenTask,
  restricted = false,
  ref,
}: {
  people: Assignee[]
  meId: string
  /** Hôm nay (YYYY-MM-DD, giờ VN) — đọc một lần ở màn cha. */
  today: string
  onDone: (assigneeName: string) => void
  /** Có thì hiện nút đóng cạnh tiêu đề — hộp mở bên phải Bàn làm việc (P4). */
  onClose?: () => void
  /** Mở chi tiết việc vừa giao — dùng khi có tệp chưa lên được. */
  onOpenTask?: (id: string) => void
  /** Người giao bị giới hạn phòng nhận (Bán Hàng) — hiện câu gợi ý dưới ô người nhận. */
  restricted?: boolean
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
  const [picked, setPicked] = useState<File[]>([])
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([])
  const [partial, setPartial] = useState<{ id: string; failed: string[] } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
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
      const { task } = await api<{ task: { id: string } }>('/api/tasks', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: detail.trim() || null,
          assignee_id: assignee,
          due_date: dueIso ? dueEndOfDay(dueIso) : null,
          priority: urgent ? 'urgent' : 'normal',
        },
      })
      // Việc đã tạo. Tệp lên từng cái một; cái lỗi chỉ được báo, việc không mất.
      const failed: string[] = []
      for (const f of picked) {
        try {
          await uploadFileTracked(
            f,
            { kind: 'task', id: task.id },
            'attachments',
            isImageMime(f.type) ? 'image' : null,
          )
        } catch {
          failed.push(f.name)
        }
      }
      setPartial(failed.length > 0 ? { id: task.id, failed } : null)
      onDone(who?.name ?? 'người nhận')
      setPicked([])
      setRejected([])
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
          emptyHint={
            restricted
              ? 'Không thấy ai khớp. Bán Hàng chỉ giao được cho Kỹ thuật và Cung ứng; việc cho phòng khác nhờ quản lý hoặc sếp giao.'
              : undefined
          }
        />
        {restricted && (
          <p className="text-[12px] text-[var(--muted-foreground)]">
            Bán Hàng chỉ giao được cho Kỹ thuật và Cung ứng. Gõ không dấu để tìm nhanh.
          </p>
        )}
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
          Mô tả{' '}
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
      <div className="flex flex-col gap-1.5">
        <span className={labelCls}>
          Tệp đính kèm{' '}
          <span className="font-mono tracking-normal normal-case tabular-nums">
            {picked.length} / {MAX_TASK_FILES}
          </span>
        </span>
        <input
          ref={fileRef}
          id="pcv-tep"
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const r = pickTaskFiles([...(e.currentTarget.files ?? [])], picked.length)
            setPicked((p) => [...p, ...r.accepted])
            setRejected(r.rejected.map((x) => ({ name: x.name, reason: x.reason })))
            e.currentTarget.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={picked.length >= MAX_TASK_FILES}
          className="flex items-center gap-2 border border-dashed border-[var(--muted-foreground)] bg-[var(--card)] px-3 py-2 text-left text-[12px] text-[var(--muted-foreground)] hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--muted)]"
        >
          <Paperclip size={16} aria-hidden />
          <span>
            <b className="text-[var(--primary)]">Chọn tệp</b> — ảnh tối đa 5 MB, tài liệu
            tối đa 50 MB
          </span>
        </button>
        {picked.length > 0 && (
          <ul className="flex flex-col border border-[var(--border)] bg-[var(--card)]">
            {picked.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2 border-b border-[var(--border)] px-2 py-1 text-[12px] last:border-b-0"
              >
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{f.name}</span>
                <span className="font-mono text-[var(--muted-foreground)] tabular-nums">
                  {formatBytes(f.size)}
                </span>
                <button
                  type="button"
                  aria-label={`Bỏ tệp ${f.name}`}
                  className="text-[var(--muted-foreground)] hover:text-[var(--stop)]"
                  onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {rejected.map((r) => (
          <p key={r.name} role="alert" className="text-[12px] text-[var(--stop)]">
            {r.name}: {r.reason}
          </p>
        ))}
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
      {partial && (
        <p
          role="alert"
          className="rounded-md border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-2 py-1.5 text-[12px] text-[var(--warn)]"
        >
          Việc đã giao, nhưng {partial.failed.length} tệp chưa lên được:{' '}
          {partial.failed.join(', ')}.{' '}
          {onOpenTask && (
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => onOpenTask(partial.id)}
            >
              Mở việc để thêm lại
            </button>
          )}
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
