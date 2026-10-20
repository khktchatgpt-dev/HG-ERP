'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CornerDownLeft,
  ExternalLink,
  ImagePlus,
  Lock,
  Pencil,
  RotateCcw,
  Send,
  ThumbsUp,
  Trash2,
  Undo2,
} from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/shadcn/dialog'
import { Spinner } from '@/components/erp/Spinner'
import { FeedbackImages, PendingImages } from '@/components/feedback/FeedbackImages'
import { useImagePaste } from '@/components/feedback/useImagePaste'
import {
  KIND_LABEL,
  SEVERITY_LABEL,
  SEVERITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  TOPIC_LABEL,
  TYPE_LABEL,
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackStatus,
  type FeedbackTopic,
  type FeedbackType,
} from '@/lib/feedback-labels'
import type { FeedbackComment, FeedbackItem, FeedbackMeta, FeedbackPerson } from '@/lib/feedback-types'
import { cn } from '@/lib/utils'
import { fmtDateTime, timeAgo } from './feedback-ui'
import { EditForm, ProcessPanel, ReviewForm } from './FeedbackForms'

type Detail = { feedback: FeedbackItem; comments: FeedbackComment[] }

/**
 * HỘP CHI TIẾT MỘT GÓP Ý: nội dung + ảnh, trả lời admin, lý do trả lại, nút
 * theo vai (người viết: Đã ổn / Vẫn cần chỉnh thêm / Gửi lại / Sửa / Xoá;
 * người xác nhận: Đồng ý / Trả lại; admin: Xử lý), và LUỒNG TRAO ĐỔI theo vòng
 * (dòng admin nổi bật, mốc trạng thái, ảnh, nhắc tên @, sửa / xoá dòng của mình).
 */
export function FeedbackDetail({
  id,
  meta,
  onClose,
  onChanged,
}: {
  id: string
  meta: FeedbackMeta
  onClose: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [data, setData] = useState<Detail | null>(null)
  const [people, setPeople] = useState<FeedbackPerson[]>([])
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reviewMode, setReviewMode] = useState<'approve' | 'return' | null>(null)
  const [needsMore, setNeedsMore] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    try {
      setData(await api<Detail>(`/api/feedback/${id}`))
    } catch (e) {
      toast.error('Không mở được góp ý', apiErrorText(e))
      onClose()
    }
  }, [id, toast, onClose])

  useEffect(() => {
    // load() là async — setState trong callback đã resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
    api<{ people: FeedbackPerson[] }>('/api/feedback/people')
      .then((r) => setPeople(r.people))
      .catch(() => undefined)
  }, [load])

  const changed = useCallback(async () => {
    await load()
    onChanged()
  }, [load, onChanged])

  async function run(label: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(true)
    try {
      await fn()
      if (ok) toast.success(ok)
      await changed()
      return true
    } catch (e) {
      toast.error(label, apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  const fb = data?.feedback
  const comments = data?.comments ?? []

  async function remove() {
    if (!fb) return
    const ok = await confirm({
      title: 'Xoá góp ý này?',
      description: 'Xoá cả luồng trao đổi và ảnh kèm. Không hoàn tác được.',
      confirmLabel: 'Xoá',
      tone: 'danger',
    })
    if (!ok) return
    const done = await run('Chưa xoá được', () => api(`/api/feedback/${fb.id}`, { method: 'DELETE' }), 'Đã xoá góp ý')
    if (done) onClose()
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92dvh] flex-col gap-0 p-0 sm:max-w-3xl">
        {!fb ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="border-b px-5 py-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={STATUS_TONE[fb.status]}>
                  {fb.status === 'done' && fb.confirmed_ok_at ? 'Đã xong — người dùng xác nhận' : STATUS_LABEL[fb.status]}
                </Badge>
                <Badge tone={SEVERITY_TONE[fb.severity as FeedbackSeverity] ?? 'gray'}>
                  {SEVERITY_LABEL[fb.severity as FeedbackSeverity]?.label ?? fb.severity}
                </Badge>
                <Badge tone="gray">
                  {KIND_LABEL[fb.kind as FeedbackKind]?.label ?? fb.kind} · {TYPE_LABEL[fb.type as FeedbackType] ?? fb.type}
                </Badge>
                {fb.topic && <Badge tone="blue">{TOPIC_LABEL[fb.topic as FeedbackTopic] ?? fb.topic}</Badge>}
                {fb.is_private && (
                  <Badge tone="gray">
                    <Lock className="mr-1 size-3" aria-hidden /> Riêng tư
                  </Badge>
                )}
                {fb.reopen_count > 0 && (
                  <Badge tone="amber">
                    <RotateCcw className="mr-1 size-3" aria-hidden /> Vòng {fb.reopen_count + 1}
                  </Badge>
                )}
              </div>
              <DialogTitle className="t-title mt-2 pr-8">
                {fb.title}
                {fb.edited_at && <span className="text-muted-foreground ml-1 text-sm font-normal">(đã sửa)</span>}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                <span>
                  {fb.author_name}
                  {fb.department_name ? ` · ${fb.department_name}` : ''}
                </span>
                <span>· {fmtDateTime(fb.created_at)}</span>
                {fb.page_url && (
                  <a
                    href={fb.page_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
                    title={fb.page_url}
                  >
                    <ExternalLink className="size-3" aria-hidden /> {fb.page_title || fb.page_url}
                  </a>
                )}
              </DialogDescription>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {editing ? (
                <EditForm
                  fb={fb}
                  busy={busy}
                  onCancel={() => setEditing(false)}
                  onSave={async (body) => {
                    const ok = await run('Chưa lưu được', () => api(`/api/feedback/${fb.id}`, { method: 'PUT', body }), 'Đã sửa góp ý')
                    if (ok) setEditing(false)
                  }}
                />
              ) : (
                <>
                  <p className="text-sm whitespace-pre-wrap">{fb.content}</p>
                  <FeedbackImages ids={fb.file_ids} size="md" />
                </>
              )}

              {fb.status === 'returned' && fb.returned_reason && (
                <div className="rounded-lg border border-l-4 border-l-[var(--warn)] p-3 text-sm">
                  <b>Người xác nhận trả lại:</b> {fb.returned_reason}
                  <div className="text-muted-foreground mt-1 text-xs">Sửa nội dung rồi bấm Gửi lại.</div>
                </div>
              )}
              {fb.admin_reply && (
                <div className="rounded-lg border border-l-4 border-l-[var(--primary)] bg-[var(--accent)]/40 p-3 text-sm">
                  <div className="t-label mb-1">Trả lời chính thức{fb.admin_replied_at ? ` · ${fmtDateTime(fb.admin_replied_at)}` : ''}</div>
                  <p className="whitespace-pre-wrap">{fb.admin_reply}</p>
                </div>
              )}

              {/* ── Hành động theo vai ───────────────────────────────── */}
              <div className="flex flex-wrap items-center gap-2">
                {fb.created_by !== meta.me && (
                  <Button
                    type="button"
                    variant={fb.voted ? 'secondary' : 'outline'}
                    size="sm"
                    disabled={busy}
                    onClick={() => void run('Chưa ghi được', () => api(`/api/feedback/${fb.id}/vote`, { method: 'POST' }))}
                    aria-pressed={fb.voted}
                  >
                    <ThumbsUp aria-hidden /> Tôi cũng gặp · {fb.vote_count}
                  </Button>
                )}
                {fb.can_confirm_ok && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run('Chưa ghi được', () => api(`/api/feedback/${fb.id}/confirm-ok`, { method: 'POST' }), 'Đã xác nhận ổn — cảm ơn bạn')}
                  >
                    <CheckCircle2 aria-hidden /> Đã ổn
                  </Button>
                )}
                {fb.can_ask_more && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setNeedsMore(true)
                      setTimeout(() => composerRef.current?.focus(), 0)
                    }}
                  >
                    <Undo2 aria-hidden /> Vẫn cần chỉnh thêm
                  </Button>
                )}
                {fb.can_resubmit && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void run('Chưa gửi lại được', () => api(`/api/feedback/${fb.id}/resubmit`, { method: 'POST', body: {} }), 'Đã gửi lại, chờ xác nhận')}
                  >
                    <Send aria-hidden /> Gửi lại
                  </Button>
                )}
                {fb.can_review && reviewMode === null && (
                  <>
                    <Button type="button" size="sm" disabled={busy} onClick={() => setReviewMode('approve')}>
                      <Check aria-hidden /> Đồng ý
                    </Button>
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setReviewMode('return')}>
                      <Undo2 aria-hidden /> Trả lại
                    </Button>
                  </>
                )}
                {fb.can_edit && !editing && (
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)}>
                    <Pencil aria-hidden /> Sửa
                  </Button>
                )}
                {fb.can_delete && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove()} className="text-[var(--stop)]">
                    <Trash2 aria-hidden /> Xoá
                  </Button>
                )}
              </div>

              {reviewMode && (
                <ReviewForm
                  mode={reviewMode}
                  fb={fb}
                  busy={busy}
                  onCancel={() => setReviewMode(null)}
                  onSubmit={async (body) => {
                    const ok = await run(
                      'Chưa ghi được',
                      () => api(`/api/feedback/${fb.id}/review`, { method: 'POST', body }),
                      body.approve ? 'Đã xác nhận, chuyển đội phát triển' : 'Đã trả lại người viết',
                    )
                    if (ok) setReviewMode(null)
                  }}
                />
              )}

              {meta.can_manage && (
                <ProcessPanel
                  key={`${fb.status}|${fb.topic ?? ''}`}
                  fb={fb}
                  busy={busy}
                  onSubmit={(body) => run('Chưa xử lý được', () => api(`/api/feedback/${fb.id}/process`, { method: 'POST', body }), 'Đã cập nhật góp ý')}
                />
              )}

              {/* ── Luồng trao đổi ───────────────────────────────────── */}
              <section className="flex flex-col gap-2">
                <h3 className="t-label">Trao đổi ({comments.filter((c) => c.kind !== 'status').length})</h3>
                <Thread
                  comments={comments}
                  feedbackId={fb.id}
                  busy={busy}
                  onEdit={(c, body) => run('Chưa sửa được', () => api(`/api/feedback/${fb.id}/comments/${c.id}`, { method: 'PUT', body }))}
                  onDelete={async (c) => {
                    const ok = await confirm({ title: 'Xoá dòng trao đổi này?', confirmLabel: 'Xoá', tone: 'danger' })
                    if (ok) await run('Chưa xoá được', () => api(`/api/feedback/${fb.id}/comments/${c.id}`, { method: 'DELETE' }))
                  }}
                />
              </section>
            </div>

            <Composer
              feedbackId={fb.id}
              people={people}
              needsMore={needsMore}
              onToggleNeedsMore={fb.can_ask_more ? setNeedsMore : undefined}
              busy={busy}
              textareaRef={composerRef}
              onSend={async (body) => {
                const ok = await run('Chưa gửi được', () => api(`/api/feedback/${fb.id}/comments`, { method: 'POST', body }), body.needs_more ? 'Đã mở lại góp ý' : undefined)
                if (ok) setNeedsMore(false)
                return ok
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Luồng trao đổi ──────────────────────────────────────────────────────────

const KIND_TAG: Record<string, { label: string; tone: 'blue' | 'amber' | 'green' | 'gray' } | null> = {
  comment: null,
  reply: { label: 'Admin trả lời', tone: 'blue' },
  needs_more: { label: 'Vẫn cần chỉnh thêm', tone: 'amber' },
  confirmed: { label: 'Đã ổn', tone: 'green' },
  status: null,
}

function Thread({
  comments,
  feedbackId,
  busy,
  onEdit,
  onDelete,
}: {
  comments: FeedbackComment[]
  feedbackId: string
  busy: boolean
  onEdit: (c: FeedbackComment, body: { content: string; file_ids: string[] }) => Promise<boolean>
  onDelete: (c: FeedbackComment) => Promise<void>
}) {
  const [editId, setEditId] = useState<string | null>(null)
  if (comments.length === 0) {
    return <p className="text-muted-foreground text-sm">Chưa có trao đổi nào — viết dòng đầu tiên bên dưới.</p>
  }
  // Đầu mỗi vòng mới (từ vòng 2) chèn một nhãn "Vòng n" — tính trước, không
  // gán biến trong lúc render.
  const rows = comments.map((c, i) => ({
    c,
    roundHead: i > 0 && c.round > 0 && comments[i - 1].round !== c.round,
  }))
  return (
    <ol className="flex flex-col gap-2">
      {rows.map(({ c, roundHead }) => {
        if (c.kind === 'status') {
          return (
            <li key={c.id} className="text-muted-foreground flex items-center gap-2 text-xs">
              <span className="bg-border h-px flex-1" />
              <span>
                {c.author_name} · {STATUS_LABEL[c.from_status as FeedbackStatus] ?? c.from_status} →{' '}
                <b className="text-foreground">{STATUS_LABEL[c.to_status as FeedbackStatus] ?? c.to_status}</b> · {timeAgo(c.created_at)}
              </span>
              <span className="bg-border h-px flex-1" />
            </li>
          )
        }
        const tag = KIND_TAG[c.kind]
        return (
          <li key={c.id} className="flex flex-col gap-1">
            {roundHead && <div className="t-label mt-2 text-[var(--warn)]">Vòng {c.round + 1}</div>}
            <div className={cn('rounded-lg border p-3 text-sm', c.is_admin && 'border-l-4 border-l-[var(--primary)]', c.kind === 'needs_more' && 'border-l-4 border-l-[var(--warn)]')}>
              <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <b className="text-foreground">{c.author_name}</b>
                {tag && <Badge tone={tag.tone}>{tag.label}</Badge>}
                <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
                {c.edited_at && <span className="text-muted-foreground">(đã sửa)</span>}
                {c.can_edit && editId !== c.id && (
                  <span className="ml-auto flex gap-1">
                    <Button type="button" variant="ghost" size="icon" className="size-6" aria-label="Sửa dòng" disabled={busy} onClick={() => setEditId(c.id)}>
                      <Pencil className="size-3.5" aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="size-6 text-[var(--stop)]" aria-label="Xoá dòng" disabled={busy} onClick={() => void onDelete(c)}>
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  </span>
                )}
              </div>
              {editId === c.id ? (
                <CommentEdit
                  c={c}
                  feedbackId={feedbackId}
                  busy={busy}
                  onCancel={() => setEditId(null)}
                  onSave={async (body) => {
                    if (await onEdit(c, body)) setEditId(null)
                  }}
                />
              ) : (
                <>
                  {c.content && <p className="whitespace-pre-wrap">{highlightMentions(c.content)}</p>}
                  <FeedbackImages ids={c.file_ids} className="mt-2" />
                </>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function highlightMentions(text: string): React.ReactNode {
  const parts = text.split(/(@[^\s@,.;:!?]+(?:\s[^\s@,.;:!?]+){0,3})/g)
  return parts.map((p, i) =>
    p.startsWith('@') ? (
      <span key={i} className="font-medium text-[var(--primary)]">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function CommentEdit({
  c,
  feedbackId,
  busy,
  onCancel,
  onSave,
}: {
  c: FeedbackComment
  feedbackId: string
  busy: boolean
  onCancel: () => void
  onSave: (body: { content: string; file_ids: string[] }) => Promise<void>
}) {
  const [content, setContent] = useState(c.content ?? '')
  const [kept, setKept] = useState<string[]>(c.file_ids)
  const parent = useMemo(() => ({ kind: 'feedback' as const, id: feedbackId }), [feedbackId])
  const paste = useImagePaste(parent)
  return (
    <div className="flex flex-col gap-2" onPaste={paste.onPaste}>
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} className="bg-card" />
      {kept.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <FeedbackImages ids={kept} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setKept([])}>
            Bỏ ảnh cũ
          </Button>
        </div>
      )}
      <PendingImages images={paste.images} onRemove={paste.remove} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Huỷ
        </Button>
        <Button type="button" size="sm" disabled={busy || paste.uploading || !content.trim()} onClick={() => void onSave({ content: content.trim(), file_ids: [...kept, ...paste.ids] })}>
          Lưu
        </Button>
      </div>
    </div>
  )
}

// ── Ô viết trao đổi (dán ảnh, nhắc tên @, Ctrl+Enter) ───────────────────────

function Composer({
  feedbackId,
  people,
  needsMore,
  onToggleNeedsMore,
  busy,
  textareaRef,
  onSend,
}: {
  feedbackId: string
  people: FeedbackPerson[]
  needsMore: boolean
  onToggleNeedsMore?: (v: boolean) => void
  busy: boolean
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onSend: (body: { content: string; needs_more: boolean; file_ids: string[] }) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const parent = useMemo(() => ({ kind: 'feedback' as const, id: feedbackId }), [feedbackId])
  const paste = useImagePaste(parent)

  // Gợi ý nhắc tên: token "@abc" cuối chuỗi đang gõ.
  const mentionQuery = useMemo(() => {
    const m = /(?:^|\s)@([^\s@]*)$/.exec(text)
    return m ? m[1] : null
  }, [text])
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return people.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionQuery, people])

  function pick(p: FeedbackPerson) {
    setText((t) => t.replace(/@([^\s@]*)$/, `@${p.name} `))
    textareaRef.current?.focus()
  }

  async function send() {
    if (!text.trim() && paste.ids.length === 0) return
    if (paste.uploading) return
    const ok = await onSend({ content: text.trim(), needs_more: needsMore, file_ids: paste.ids })
    if (ok) {
      setText('')
      paste.reset()
    }
  }

  return (
    <div className="border-t px-5 py-3" onPaste={paste.onPaste} onDrop={paste.onDrop} onDragOver={(e) => e.preventDefault()}>
      {needsMore && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-[color-mix(in_srgb,var(--warn)_40%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-2 py-1 text-xs text-[var(--warn)]">
          <AlertTriangle className="size-3.5" aria-hidden />
          Đang viết “Vẫn cần chỉnh thêm” — nói rõ còn thiếu gì, góp ý sẽ mở lại thành vòng mới.
          {onToggleNeedsMore && (
            <Button type="button" variant="ghost" size="sm" className="ml-auto h-6" onClick={() => onToggleNeedsMore(false)}>
              Bỏ
            </Button>
          )}
        </div>
      )}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              void send()
            }
          }}
          rows={2}
          placeholder={needsMore ? 'Còn cần chỉnh gì? (ít nhất 5 ký tự)' : 'Viết trao đổi… @tên để nhắc ai đó, Ctrl+V dán ảnh, Ctrl+Enter gửi'}
          className="bg-card min-h-16"
        />
        {suggestions.length > 0 && (
          <ul className="bg-popover absolute bottom-full left-0 z-10 mb-1 w-64 overflow-hidden rounded-md border shadow-md">
            {suggestions.map((p) => (
              <li key={p.id}>
                <Button type="button" variant="ghost" size="sm" className="w-full justify-start rounded-none" onClick={() => pick(p)}>
                  @{p.name}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <PendingImages images={paste.images} onRemove={paste.remove} />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={busy}>
          <ImagePlus aria-hidden /> Ảnh
        </Button>
        <Input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void paste.addFiles(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        {onToggleNeedsMore && !needsMore && (
          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox checked={needsMore} onCheckedChange={(v) => onToggleNeedsMore(v === true)} /> Vẫn cần chỉnh thêm
          </label>
        )}
        <span className="text-muted-foreground ml-auto hidden items-center gap-1 text-[11px] sm:flex">
          <CornerDownLeft className="size-3" aria-hidden /> Ctrl+Enter
        </span>
        <Button type="button" size="sm" onClick={() => void send()} disabled={busy || paste.uploading || (!text.trim() && paste.ids.length === 0)}>
          {busy ? <Spinner size={14} /> : <Send aria-hidden />} Gửi
        </Button>
      </div>
    </div>
  )
}

