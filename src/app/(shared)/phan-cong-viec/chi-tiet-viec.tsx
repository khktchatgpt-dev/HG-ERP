'use client'

import { useEffect, useState } from 'react'
import { Check, Play, RotateCcw, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { taskAttachBlock, TASK_STATUS_LABEL, type TaskStatus } from '@/lib/task-flow'
import type { Comment } from '@/modules/workflow/tasks/comments.repo'
import type { TaskFileItem } from '@/modules/core/files/files.service'
import type { AssignedItem, GivenItem } from '@/modules/workflow/tasks/tasks.service'
import { btn, dmVn, fieldCls, labelCls, Tag } from './phan-cong.shared'
import { TepDinhKem } from './tep-dinh-kem'

/**
 * CHI TIẾT VIỆC (bản vẽ 2, B3 — 03/11/2026): ngăn kéo bên phải danh sách. Người nhận
 * đọc mô tả, mở ảnh và tài liệu, báo hoàn thành kèm kết quả và tệp; người giao thấy
 * cùng nội dung và có Duyệt / Trả lại / Huỷ. Nút lấy từ `item.actions` do máy chủ
 * tính — màn không tự suy quyền. Viết không kit.
 */

type Item = AssignedItem | GivenItem

const TONE: Record<TaskStatus, 'off' | 'act' | 'warn' | 'done' | 'stop'> = {
  todo: 'off',
  in_progress: 'act',
  submitted: 'warn',
  done: 'done',
  rejected: 'stop',
  cancelled: 'off',
  on_hold: 'off',
}

const KIND_LABEL: Partial<Record<Comment['kind'], string>> = {
  progress_report: 'Đã báo hoàn thành',
  rejection: 'Trả lại',
  approval: 'Đã duyệt',
}

/** dd/mm hh:mm giờ VN. */
function when(at: string): string {
  const t = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(at))
  return `${dmVn(at)} ${t}`
}

export function ChiTietViec({
  item,
  meId,
  meRole,
  onClose,
  onChanged,
}: {
  item: Item
  meId: string
  meRole: string
  onClose: () => void
  /** Sau mỗi bước ghi xong — màn cha tải lại danh sách. */
  onChanged: () => void
}) {
  const [files, setFiles] = useState<TaskFileItem[] | null>(null)
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [tick, setTick] = useState(0)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [mode, setMode] = useState<'submit' | 'reject' | null>(null)
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loi, setLoi] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    Promise.all([
      api<{ files: TaskFileItem[] }>(`/api/tasks/${item.id}/files`),
      api<{ comments: Comment[] }>(`/api/tasks/${item.id}/comments`),
    ])
      .then(([f, c]) => {
        if (!live) return
        setFiles(f.files)
        setComments(c.comments)
        setLoadErr(null)
      })
      .catch((e) => live && setLoadErr(apiErrorText(e, 'Chưa tải được chi tiết việc')))
    return () => {
      live = false
    }
  }, [item.id, tick])

  const attachBlock = taskAttachBlock(item, { id: meId, role: meRole })
  const has = (a: string) => (item.actions as string[]).includes(a)
  const isTaker = item.assignee_id === meId

  async function call(path: string, body?: unknown, after?: () => void) {
    setBusy(true)
    setLoi(null)
    try {
      await api(`/api/tasks/${item.id}/${path}`, { method: 'POST', body })
      after?.()
      setMode(null)
      setText('')
      setNote('')
      setTick((t) => t + 1)
      onChanged()
    } catch (e) {
      setLoi(apiErrorText(e, 'Chưa ghi được — thử lại'))
    } finally {
      setBusy(false)
    }
  }

  const overdue = 'overdue_days' in item ? item.overdue_days : 0

  return (
    <aside
      aria-label={`Chi tiết việc ${item.title}`}
      className="flex min-w-0 flex-col bg-[var(--card)]"
    >
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-3.5 py-2.5">
        <span className="font-mono text-[12px] text-[var(--muted-foreground)]">
          {item.task_code ?? 'Việc'}
        </span>
        {item.priority === 'urgent' && <Tag tone="stop">Gấp</Tag>}
        <span className="flex-1" />
        <button
          type="button"
          aria-label="Đóng chi tiết việc"
          className={btn('ghost', false, true)}
          onClick={onClose}
        >
          <X size={14} aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-3.5 overflow-auto px-3.5 py-3">
        <h2 className="text-[16px] leading-snug font-semibold text-[var(--foreground)]">
          {item.title}
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag tone={overdue > 0 ? 'stop' : TONE[item.status]}>
            {overdue > 0 ? `Quá hạn ${overdue} ngày` : TASK_STATUS_LABEL[item.status]}
          </Tag>
          {overdue > 0 && <Tag tone="off">{TASK_STATUS_LABEL[item.status]}</Tag>}
        </div>

        <dl className="grid grid-cols-[84px_1fr] gap-x-3 gap-y-1 text-[13px]">
          <dt className="text-[var(--muted-foreground)]">Giao bởi</dt>
          <dd>
            {item.assigner_name ?? '—'}
            <span className="text-[var(--muted-foreground)]">
              {' '}
              · {dmVn(item.created_at)}
            </span>
          </dd>
          <dt className="text-[var(--muted-foreground)]">Người làm</dt>
          <dd>
            {item.assignee_name ?? '—'}
            {item.department_name && (
              <span className="text-[var(--muted-foreground)]">
                {' '}
                · {item.department_name}
              </span>
            )}
          </dd>
          <dt className="text-[var(--muted-foreground)]">Hạn</dt>
          <dd className="font-mono tabular-nums">
            {item.due_date ? dmVn(item.due_date) : '—'}
          </dd>
        </dl>

        <div className="flex flex-col gap-1">
          <span className={labelCls}>Mô tả</span>
          {item.description ? (
            <p className="text-[13px] leading-[1.5] whitespace-pre-line">
              {item.description}
            </p>
          ) : (
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Người giao chưa ghi mô tả.
            </p>
          )}
        </div>

        {files === null ? (
          <p className="text-[12px] text-[var(--muted-foreground)]">
            {loadErr ?? 'Đang tải tệp…'}
          </p>
        ) : (
          <TepDinhKem
            taskId={item.id}
            files={files}
            canAdd={attachBlock === null}
            blockReason={attachBlock}
            onChanged={() => {
              setTick((t) => t + 1)
              onChanged()
            }}
          />
        )}

        <div className="flex flex-col gap-1.5">
          <span className={labelCls}>Trao đổi và kết quả</span>
          {comments === null ? (
            <p className="text-[12px] text-[var(--muted-foreground)]">
              {loadErr ?? 'Đang tải…'}
            </p>
          ) : comments.length === 0 ? (
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Chưa có trao đổi nào.
            </p>
          ) : (
            comments.map((c) => (
              <div
                key={c.id}
                className={`flex flex-col gap-0.5 border-l-2 pl-2.5 ${c.kind === 'rejection' ? 'border-[var(--stop)]' : c.kind === 'progress_report' || c.kind === 'approval' ? 'border-[var(--done)]' : 'border-[var(--border)]'}`}
              >
                <span className="text-[12px] font-semibold">
                  {c.user_name ?? c.user_email}
                  <span className="font-normal text-[var(--muted-foreground)]">
                    {' '}
                    · {when(c.created_at)}
                    {KIND_LABEL[c.kind] ? ` · ${KIND_LABEL[c.kind]}` : ''}
                  </span>
                </span>
                <p className="text-[13px] whitespace-pre-line">{c.body}</p>
              </div>
            ))
          )}
          {item.status !== 'done' && item.status !== 'cancelled' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="ctv-note" className="sr-only">
                Viết trao đổi
              </label>
              <textarea
                id="ctv-note"
                rows={2}
                maxLength={4000}
                className={`${fieldCls} resize-y py-1.5`}
                placeholder="Hỏi thêm, báo tiến độ, ghi chú cho bên kia…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div>
                <button
                  type="button"
                  aria-disabled={!note.trim() || busy}
                  className={btn('normal', !note.trim() || busy, true)}
                  onClick={() =>
                    note.trim() &&
                    !busy &&
                    void call('comments', { body: note.trim(), kind: 'comment' })
                  }
                >
                  Gửi
                </button>
              </div>
            </div>
          )}
        </div>

        {mode === 'submit' && (
          <div className="flex flex-col gap-1.5 border border-[var(--border)] bg-[var(--muted)] p-2.5">
            <label htmlFor="ctv-kq" className={labelCls}>
              Kết quả — người giao đọc câu này để duyệt
            </label>
            <textarea
              id="ctv-kq"
              rows={3}
              autoFocus
              maxLength={2000}
              className={`${fieldCls} resize-y py-1.5`}
              placeholder="Đã làm gì, còn gì chưa xong… Đính ảnh / tệp kết quả ở mục Tệp đính kèm phía trên."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        {mode === 'reject' && (
          <div className="flex flex-col gap-1.5 border border-[var(--border)] bg-[var(--muted)] p-2.5">
            <label htmlFor="ctv-ly-do" className={labelCls}>
              Lý do trả lại — người làm đọc để sửa
            </label>
            <textarea
              id="ctv-ly-do"
              rows={3}
              autoFocus
              maxLength={2000}
              className={`${fieldCls} resize-y py-1.5`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}
        {loi && (
          <p role="alert" className="text-[12px] text-[var(--stop)]">
            {loi}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] bg-[var(--muted)] px-3.5 py-2.5">
        {mode ? (
          <>
            <button
              type="button"
              aria-disabled={!text.trim() || busy}
              className={btn('primary', !text.trim() || busy)}
              onClick={() => {
                if (!text.trim() || busy) return
                if (mode === 'submit') void call('submit', { result: text.trim() })
                else void call('reject', { reason: text.trim() })
              }}
            >
              <Check size={14} aria-hidden />
              {mode === 'submit' ? 'Báo hoàn thành' : 'Trả lại'}
            </button>
            <button
              type="button"
              className={btn('ghost')}
              onClick={() => {
                setMode(null)
                setText('')
              }}
            >
              Thôi
            </button>
            {!text.trim() && (
              <span className="text-[12px] text-[var(--warn)]">
                {mode === 'submit' ? 'Ghi một câu kết quả' : 'Ghi lý do trả lại'}
              </span>
            )}
          </>
        ) : (
          <>
            {isTaker && has('start') && item.status !== 'rejected' && (
              <button
                type="button"
                className={btn('normal')}
                disabled={busy}
                onClick={() => void call('status', { status: 'in_progress' })}
              >
                <Play size={14} aria-hidden />
                Bắt đầu
              </button>
            )}
            {isTaker && has('submit') && (
              <button
                type="button"
                className={btn('primary')}
                onClick={() => setMode('submit')}
              >
                <Check size={14} aria-hidden />
                Báo hoàn thành
              </button>
            )}
            {has('approve') && (
              <button
                type="button"
                className={btn('primary')}
                disabled={busy}
                onClick={() => void call('approve', {})}
              >
                <Check size={14} aria-hidden />
                Duyệt Đạt
              </button>
            )}
            {has('reject') && (
              <button
                type="button"
                className={btn('normal')}
                onClick={() => setMode('reject')}
              >
                Trả lại
              </button>
            )}
            {has('restore') && (
              <button
                type="button"
                className={btn('normal')}
                disabled={busy}
                onClick={() => void call('status', { status: 'todo' })}
              >
                <RotateCcw size={14} aria-hidden />
                Mở lại
              </button>
            )}
            {has('cancel') && !isTaker && (
              <button
                type="button"
                className={btn('ghost')}
                disabled={busy}
                onClick={() => void call('status', { status: 'cancelled' })}
              >
                Huỷ việc
              </button>
            )}
            <span className="flex-1" />
            <span className="text-[12px] text-[var(--muted-foreground)]">
              {isTaker && item.status === 'submitted'
                ? 'Chờ người giao duyệt'
                : item.status === 'submitted'
                  ? 'Đang chờ bạn duyệt'
                  : ''}
            </span>
          </>
        )}
      </div>
    </aside>
  )
}
