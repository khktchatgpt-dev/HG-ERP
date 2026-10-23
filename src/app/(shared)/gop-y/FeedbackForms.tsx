'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Checkbox } from '@/components/shadcn/checkbox'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { FeedbackImages, PendingImages } from '@/components/feedback/FeedbackImages'
import { useImagePaste } from '@/components/feedback/useImagePaste'
import { Chip } from '@/components/feedback/QuickFeedbackButton'
import {
  FEEDBACK_KINDS,
  FEEDBACK_SEVERITIES,
  FEEDBACK_TOPICS,
  KIND_LABEL,
  MANAGER_STATUSES,
  SEVERITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  TYPES_BY_KIND,
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackType,
} from '@/lib/feedback-labels'
import type { FeedbackItem } from '@/lib/feedback-types'
import { cn } from '@/lib/utils'

/**
 * BA FORM PHỤ CỦA HỘP CHI TIẾT GÓP Ý — tách khỏi FeedbackDetail cho vừa
 * max-lines: người xác nhận (Đồng ý / Trả lại), khung xử lý của admin, và
 * người viết tự sửa.
 */

// ── Form người xác nhận ─────────────────────────────────────────────────────

export function ReviewForm({
  mode,
  fb,
  busy,
  onCancel,
  onSubmit,
}: {
  mode: 'approve' | 'return'
  fb: FeedbackItem
  busy: boolean
  onCancel: () => void
  onSubmit: (body: { approve: boolean; note: string; severity?: string }) => Promise<void>
}) {
  const [note, setNote] = useState('')
  const [severity, setSeverity] = useState<FeedbackSeverity>(fb.severity as FeedbackSeverity)
  const approve = mode === 'approve'
  return (
    <div className={cn('rounded-lg border p-3', !approve && 'border-l-4 border-l-[var(--warn)]')}>
      <div className="t-label mb-2">{approve ? 'Đồng ý — chuyển đội phát triển' : 'Trả lại người viết'}</div>
      {approve && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground mr-1">Mức độ:</span>
          {FEEDBACK_SEVERITIES.map((s) => (
            <Chip key={s} active={severity === s} onClick={() => setSeverity(s)} tone={s === 'blocking' ? 'stop' : undefined}>
              {SEVERITY_LABEL[s].label}
            </Chip>
          ))}
        </div>
      )}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder={approve ? 'Ghi chú cho đội phát triển (tuỳ chọn)' : 'Lý do trả lại — bắt buộc, ít nhất 3 ký tự'}
        className="bg-card"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || (!approve && note.trim().length < 3)}
          onClick={() => void onSubmit({ approve, note: note.trim(), ...(approve && severity !== fb.severity ? { severity } : {}) })}
        >
          {approve ? 'Xác nhận' : 'Trả lại'}
        </Button>
      </div>
    </div>
  )
}

// ── Khung xử lý của admin ───────────────────────────────────────────────────

export function ProcessPanel({
  fb,
  busy,
  onSubmit,
}: {
  fb: FeedbackItem
  busy: boolean
  onSubmit: (body: { status?: string; topic?: string | null; reply?: string }) => Promise<boolean>
}) {
  // Khung được mount lại theo `key` (status|topic) ở chỗ gọi, nên state đầu
  // luôn khớp góp ý hiện tại mà không cần effect đồng bộ.
  const [status, setStatus] = useState<string>(fb.status)
  const [topic, setTopic] = useState<string>(fb.topic ?? '')
  const [reply, setReply] = useState('')
  const dirty = status !== fb.status || (topic || null) !== fb.topic || reply.trim().length > 0
  const statusOptions = [
    ...MANAGER_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    ...(MANAGER_STATUSES.includes(fb.status) ? [] : [{ value: fb.status, label: STATUS_LABEL[fb.status] }]),
  ]
  return (
    <div className="bg-muted/40 rounded-lg border p-3">
      <div className="t-label mb-2">Xử lý (admin)</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <ToolbarSelect value={status} onChange={setStatus} options={statusOptions} aria-label="Trạng thái" className="w-full" />
        <ToolbarSelect
          value={topic}
          onChange={setTopic}
          options={[{ value: '', label: 'Chủ đề: chưa gán' }, ...FEEDBACK_TOPICS.map((t) => ({ value: t.id, label: t.label }))]}
          aria-label="Chủ đề"
          className="w-full"
        />
      </div>
      <Textarea
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        rows={2}
        placeholder="Trả lời chính thức cho người viết (tuỳ chọn) — hiện nổi ở đầu góp ý"
        className="bg-card mt-2"
      />
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          disabled={busy || !dirty}
          onClick={() =>
            void onSubmit({
              ...(status !== fb.status ? { status } : {}),
              ...((topic || null) !== fb.topic ? { topic: topic || null } : {}),
              ...(reply.trim() ? { reply: reply.trim() } : {}),
            }).then((ok) => ok && setReply(''))
          }
        >
          Lưu xử lý
        </Button>
      </div>
    </div>
  )
}

// ── Người viết tự sửa ───────────────────────────────────────────────────────

export function EditForm({
  fb,
  busy,
  onCancel,
  onSave,
}: {
  fb: FeedbackItem
  busy: boolean
  onCancel: () => void
  onSave: (body: Record<string, unknown>) => Promise<void>
}) {
  const [kind, setKind] = useState<FeedbackKind>(fb.kind as FeedbackKind)
  const [type, setType] = useState<FeedbackType>(fb.type as FeedbackType)
  const [severity, setSeverity] = useState<FeedbackSeverity>(fb.severity as FeedbackSeverity)
  const [title, setTitle] = useState(fb.title)
  const [content, setContent] = useState(fb.content)
  const [isPrivate, setIsPrivate] = useState(fb.is_private)
  const [kept, setKept] = useState<string[]>(fb.file_ids)
  const parent = useMemo(() => ({ kind: 'feedback' as const, id: fb.id }), [fb.id])
  const paste = useImagePaste(parent)
  function pickKind(k: FeedbackKind) {
    setKind(k)
    if (!TYPES_BY_KIND[k].includes(type)) setType(TYPES_BY_KIND[k][0])
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3" onPaste={paste.onPaste}>
      <div className="flex flex-wrap gap-1.5">
        {FEEDBACK_KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => pickKind(k)}>
            {KIND_LABEL[k].label}
          </Chip>
        ))}
        <span className="text-muted-foreground mx-1">·</span>
        {TYPES_BY_KIND[kind].map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {TYPE_LABEL[t]}
          </Chip>
        ))}
        <span className="text-muted-foreground mx-1">·</span>
        {FEEDBACK_SEVERITIES.map((s) => (
          <Chip key={s} active={severity === s} onClick={() => setSeverity(s)} tone={s === 'blocking' ? 'stop' : undefined}>
            {SEVERITY_LABEL[s].label}
          </Chip>
        ))}
      </div>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề" maxLength={200} />
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="bg-card" />
      {kept.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <FeedbackImages ids={kept} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setKept([])}>
            Bỏ ảnh cũ
          </Button>
        </div>
      )}
      <PendingImages images={paste.images} onRemove={paste.remove} />
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isPrivate} onCheckedChange={(v) => setIsPrivate(v === true)} /> Riêng tư
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          Huỷ
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || paste.uploading || content.trim().length < 5}
          onClick={() =>
            void onSave({
              kind,
              type,
              severity,
              title: title.trim(),
              content: content.trim(),
              is_private: isPrivate,
              file_ids: [...kept, ...paste.ids],
            })
          }
        >
          Lưu
        </Button>
      </div>
    </div>
  )
}
