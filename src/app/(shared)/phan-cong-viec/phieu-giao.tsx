'use client'

import { useEffect, useRef, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { isoToVn, maskVnDate, vnToIso } from '@/lib/date-vn'
import { formatBytes } from '@/lib/file-limits'
import { extLabel, isImageMime, pickTaskFiles } from '@/lib/task-files'
import { dueEndOfDay, MAX_TASK_FILES } from '@/lib/task-flow'
import { uploadFileTracked } from '@/lib/upload'
import type { Assignee } from '@/modules/workflow/tasks/tasks.service'
import { ONguoi } from './o-nguoi'
import { addDays, nextMonday } from './phan-cong.shared'

/**
 * PHIẾU GIAO VIỆC — ngăn phải chuyển thành phiếu (bản vẽ 3, lối ERP). Nhãn trái – ô
 * phải; nút chốt ở ĐẦU ngăn (Ctrl+Enter cũng giao). Nút khoá vẫn bấm được: nói thiếu
 * gì bằng một dòng, mỗi chỗ thiếu bấm nhảy tới ô.
 *
 * Tệp lên SAU khi việc đã tạo (cần id việc). Tệp hỏng không làm mất việc: màn cha
 * nhận danh sách tệp lỗi và báo dưới Action Pane, việc vừa giao được chọn sẵn để thêm
 * lại ở ngăn chi tiết.
 */
export function PhieuGiao({
  people,
  meId,
  today,
  restricted,
  onClose,
  onDone,
}: {
  people: Assignee[]
  meId: string
  today: string
  /** Bán Hàng: chỉ giao được Kỹ thuật + Cung ứng — câu khi tìm không ra người. */
  restricted: boolean
  onClose: () => void
  onDone: (taskId: string, assigneeName: string, failedFiles: string[]) => void
}) {
  const [assignee, setAssignee] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [dueText, setDueText] = useState('')
  const [urgent, setUrgent] = useState(false)
  const [picked, setPicked] = useState<File[]>([])
  const [rejected, setRejected] = useState<{ name: string; reason: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)
  const personRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const dueRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Mở phiếu là đặt con trỏ vào ô người nhận — một lần, không autoFocus trên ô.
  useEffect(() => {
    personRef.current?.focus()
  }, [])

  const dueIso = dueText.trim() ? vnToIso(dueText) : null
  const dueErr = !dueText.trim()
    ? null
    : !dueIso
      ? 'hạn chưa đúng dd/mm/yyyy'
      : dueIso < today
        ? 'hạn đã qua'
        : null
  const missing: { label: string; field: 'person' | 'title' | 'due' }[] = [
    ...(!assignee ? [{ label: 'người nhận', field: 'person' as const }] : []),
    ...(!title.trim() ? [{ label: 'việc', field: 'title' as const }] : []),
    ...(dueErr ? [{ label: dueErr, field: 'due' as const }] : []),
  ]
  const who = people.find((p) => p.id === assignee)
  const [tried, setTried] = useState(false)

  function go(field: 'person' | 'title' | 'due') {
    ;({ person: personRef, title: titleRef, due: dueRef })[field].current?.focus()
  }

  async function submit() {
    setTried(true)
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
      onDone(task.id, who?.name ?? 'người nhận', failed)
    } catch (e) {
      // Giữ nguyên mọi ô — sửa chỗ sai rồi bấm lại.
      setLoi(apiErrorText(e, 'Chưa giao được — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  const quick: [string, string | null][] = [
    ['Hôm nay', today],
    ['Mai', addDays(today, 1)],
    ['Thứ Hai', nextMonday(today)],
    ['+7 ngày', addDays(today, 7)],
    ['Không hạn', null],
  ]
  const khoa = missing.length > 0 || busy

  return (
    <form
      aria-label="Giao việc"
      className="pc-fx"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          void submit()
        }
        if (e.key === 'Escape') onClose()
      }}
    >
      <div className="pc-fx-h">
        <span className="t">Giao việc mới</span>
        <div className="pc-ap">
          <div>
            <button type="submit" className="b p" aria-disabled={khoa}>
              {busy
                ? 'Đang giao…'
                : who
                  ? `Giao cho ${who.name.split(' ').at(-1)}`
                  : 'Giao việc'}
            </button>
            <button type="button" className="b" onClick={onClose}>
              Huỷ
            </button>
          </div>
        </div>
      </div>

      <div className="pc-fx-b">
        {tried && missing.length > 0 && (
          <p className="lack">
            Còn thiếu:{' '}
            {missing.map((m, i) => (
              <span key={m.label}>
                {i > 0 && ' · '}
                <button type="button" className="lnk" onClick={() => go(m.field)}>
                  {m.label}
                </button>
              </span>
            ))}
          </p>
        )}
        {loi && (
          <p role="alert" className="lack" style={{ color: 'var(--pc-stop)' }}>
            {loi}
          </p>
        )}

        <div className="frm">
          <label htmlFor="pcv-nguoi">Người nhận</label>
          <div>
            <ONguoi
              id="pcv-nguoi"
              people={people}
              value={assignee}
              onChange={setAssignee}
              exclude={[meId]}
              inputRef={personRef}
              emptyHint={
                restricted
                  ? 'Không thấy ai. Bán Hàng chỉ giao được cho Kỹ thuật và Cung ứng — việc cho phòng khác nhờ quản lý hoặc sếp giao.'
                  : 'Không thấy ai khớp — gõ ít chữ hơn, hoặc tên phòng.'
              }
            />
          </div>

          <label htmlFor="pcv-viec">Việc</label>
          <div>
            <input
              id="pcv-viec"
              ref={titleRef}
              maxLength={200}
              className={tried && !title.trim() ? 'in bad' : 'in'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <label htmlFor="pcv-mota">Mô tả</label>
          <div>
            <textarea
              id="pcv-mota"
              className="in"
              rows={3}
              maxLength={5000}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </div>

          <label htmlFor="pcv-han">Hạn</label>
          <div
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
          >
            <input
              id="pcv-han"
              ref={dueRef}
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              aria-invalid={!!dueErr}
              className={dueErr ? 'in num bad' : 'in num'}
              style={{ width: 104 }}
              value={dueText}
              onChange={(e) => setDueText(maskVnDate(e.target.value))}
            />
            <span className="seg" role="group" aria-label="Hạn nhanh">
              {quick.map(([label, iso]) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={iso ? dueIso === iso : !dueText.trim()}
                  onClick={() => setDueText(iso ? isoToVn(iso) : '')}
                >
                  {label}
                </button>
              ))}
            </span>
          </div>

          <span className="l">Mức</span>
          <div>
            <span className="seg" role="group" aria-label="Mức gấp">
              <button
                type="button"
                aria-pressed={!urgent}
                onClick={() => setUrgent(false)}
              >
                Thường
              </button>
              <button type="button" aria-pressed={urgent} onClick={() => setUrgent(true)}>
                Gấp
              </button>
            </span>
          </div>

          <span className="l">
            Tệp{' '}
            <span className="num">
              {picked.length}/{MAX_TASK_FILES}
            </span>
          </span>
          <div style={{ padding: 0 }}>
            {picked.map((f, i) => (
              <div key={`${f.name}-${i}`} className="fl">
                <span className="x">{extLabel(f.name)}</span>
                <span className="ten" title={f.name}>
                  {f.name}
                </span>
                <span className="num mut">{formatBytes(f.size)}</span>
                <span>
                  <button
                    type="button"
                    className="ic del"
                    aria-label={`Bỏ tệp ${f.name}`}
                    onClick={() => setPicked((p) => p.filter((_, j) => j !== i))}
                  >
                    Bỏ
                  </button>
                </span>
              </div>
            ))}
            {rejected.map((r) => (
              <div key={r.name} className="fl bad" role="alert">
                <span className="x">{extLabel(r.name)}</span>
                <span className="ten" title={`${r.name} · ${r.reason}`}>
                  {r.name} · {r.reason}
                </span>
                <span />
                <span />
              </div>
            ))}
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
              className="add"
              aria-disabled={picked.length >= MAX_TASK_FILES}
              onClick={() => picked.length < MAX_TASK_FILES && fileRef.current?.click()}
            >
              <span>
                <b>Chọn tệp</b> · ảnh tối đa 5 MB, tài liệu tối đa 50 MB
              </span>
            </button>
          </div>
        </div>
      </div>
    </form>
  )
}
