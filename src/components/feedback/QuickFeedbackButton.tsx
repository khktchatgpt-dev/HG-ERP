'use client'

import { useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ImagePlus, MessageSquarePlus, Send } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/shadcn/dialog'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import { Spinner } from '@/components/erp/Spinner'
import {
  FEEDBACK_KINDS,
  FEEDBACK_SEVERITIES,
  FEEDBACK_TOPICS,
  KIND_LABEL,
  SEVERITY_LABEL,
  TYPE_LABEL,
  TYPES_BY_KIND,
  guessTopic,
  type FeedbackKind,
  type FeedbackSeverity,
  type FeedbackType,
} from '@/lib/feedback-labels'
import { cn } from '@/lib/utils'
import { useImagePaste } from './useImagePaste'
import { PendingImages } from './FeedbackImages'

/**
 * NÚT "GÓP Ý" TRÊN THANH ĐẦU TRANG — có ở mọi màn (WorkspaceTopbar). Mở hộp
 * ghi nhanh trượt từ phải: chọn Hệ thống / Vận hành, loại, mức độ, gõ nội dung,
 * dán ảnh chụp màn hình (Ctrl+V), Ctrl+Enter gửi. Tự ghi trang đang mở.
 *
 * Quyết định từ người dùng thật (README gói, mục 8.1): phải ghi được trong ~10
 * giây từ chỗ đang đứng; bắt chuyển trang là người ta không góp ý nữa.
 */
export function QuickFeedbackButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-9 gap-1.5 text-[var(--primary)]"
        title="Ghi góp ý về hệ thống hoặc vận hành — dán được ảnh chụp màn hình"
      >
        <MessageSquarePlus aria-hidden />
        <span className="hidden sm:inline">Góp ý</span>
      </Button>
      {open && <QuickFeedbackDialog open={open} onClose={() => setOpen(false)} />}
    </>
  )
}

export function QuickFeedbackDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  /** Trang /gop-y truyền vào để nạp lại danh sách ngay. */
  onCreated?: (id: string) => void
}) {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const [kind, setKind] = useState<FeedbackKind>('system')
  const [type, setType] = useState<FeedbackType>('bug')
  const [severity, setSeverity] = useState<FeedbackSeverity>('annoying')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [topic, setTopic] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const parent = useMemo(() => ({ kind: 'none' as const }), [])
  const paste = useImagePaste(parent)

  // Đọc một lần lúc mở hộp (window chỉ có ở client; hộp chỉ mount ở client).
  const [page] = useState(() => ({
    url: typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname,
    title: typeof document !== 'undefined' ? document.title : '',
  }))
  const guessed = guessTopic(page.url)
  const guessedLabel = guessed ? FEEDBACK_TOPICS.find((t) => t.id === guessed)?.label : null

  /** Đổi nhóm thì loại không hợp lệ nhảy về loại đầu của nhóm mới. */
  function pickKind(k: FeedbackKind) {
    setKind(k)
    if (!TYPES_BY_KIND[k].includes(type)) setType(TYPES_BY_KIND[k][0])
  }

  async function submit() {
    if (content.trim().length < 5) {
      toast.error('Nội dung quá ngắn', 'Viết ít nhất 5 ký tự để người xử lý hiểu được.')
      return
    }
    if (paste.uploading) {
      toast.info('Ảnh đang tải lên', 'Chờ một chút rồi gửi lại.')
      return
    }
    setBusy(true)
    try {
      const r = await api<{ feedback: { id: string; title: string } }>('/api/feedback', {
        method: 'POST',
        body: {
          kind,
          type,
          severity,
          title: title.trim(),
          content: content.trim(),
          is_private: isPrivate,
          topic: topic || null,
          page_url: page.url,
          page_title: page.title.slice(0, 200),
          file_ids: paste.ids,
        },
      })
      toast.success('Đã gửi góp ý', `${r.feedback.title} — theo dõi ở trang Góp ý hệ thống.`)
      onClose()
      onCreated?.(r.feedback.id)
      if (!onCreated && pathname === '/gop-y') router.refresh()
    } catch (e) {
      toast.error('Chưa gửi được', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      void submit()
    }
  }

  const topicOptions = [
    { value: '', label: guessedLabel ? `Chủ đề: ${guessedLabel} (theo trang)` : 'Chủ đề: chưa chọn' },
    ...FEEDBACK_TOPICS.map((t) => ({ value: t.id, label: t.label })),
  ]

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      {/*
        Hộp TRƯỢT TỪ PHẢI, cao hết màn: ghi đè vị trí mặc định (neo giữa) của
        DialogContent. Người dùng vẫn nhìn thấy màn đang góp ý ở bên trái.
      */}
      <DialogContent
        className="top-0 right-0 left-auto flex h-dvh max-h-dvh w-full max-w-full translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-l p-0 data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 sm:max-w-xl"
        onKeyDown={onKeyDown}
        onPaste={paste.onPaste}
        onDrop={paste.onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <div className="border-b px-5 py-4">
          <DialogTitle className="t-title">Góp ý về hệ thống / vận hành</DialogTitle>
          <DialogDescription className="mt-1">
            Dán ảnh chụp màn hình bằng{' '}
            <kbd className="rounded border px-1 font-mono text-[11px]">Ctrl+V</kbd>, gửi bằng{' '}
            <kbd className="rounded border px-1 font-mono text-[11px]">Ctrl+Enter</kbd>. Trang đang
            mở được ghi kèm tự động.
          </DialogDescription>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                variant="outline"
                onClick={() => pickKind(k)}
                aria-pressed={kind === k}
                className={cn(
                  'h-auto flex-col items-start gap-0.5 rounded-lg p-3 text-left whitespace-normal',
                  kind === k && 'border-[var(--primary)] bg-[var(--accent)] hover:bg-[var(--accent)]',
                )}
              >
                <span className="font-medium">{KIND_LABEL[k].label}</span>
                <span className="text-muted-foreground text-xs font-normal">{KIND_LABEL[k].hint}</span>
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {TYPES_BY_KIND[kind].map((t) => (
              <Chip key={t} active={type === t} onClick={() => setType(t)}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>

          <div>
            <div className="t-label mb-1.5">Mức độ</div>
            <div className="flex flex-wrap gap-1.5">
              {FEEDBACK_SEVERITIES.map((s) => (
                <Chip
                  key={s}
                  active={severity === s}
                  onClick={() => setSeverity(s)}
                  title={SEVERITY_LABEL[s].hint}
                  tone={s === 'blocking' ? 'stop' : undefined}
                >
                  {SEVERITY_LABEL[s].label}
                </Chip>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="t-label">Tiêu đề (tuỳ chọn — trống thì lấy dòng đầu)</span>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Nút lưu đơn hàng bị mờ khi chưa chọn khách"
              maxLength={200}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="t-label">Nội dung</span>
            <Textarea
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Đang làm gì, bấm gì, thấy gì, mong muốn gì… Dán ảnh chụp màn hình ngay vào đây."
              className="bg-card min-h-32"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <ImagePlus aria-hidden /> Thêm ảnh
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
            <span className="text-muted-foreground text-xs">hoặc kéo thả / Ctrl+V vào hộp này</span>
          </div>
          <PendingImages images={paste.images} onRemove={paste.remove} />

          <div className="grid gap-3 sm:grid-cols-2">
            <ToolbarSelect value={topic} onChange={setTopic} options={topicOptions} aria-label="Chủ đề" className="w-full" />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPrivate} onCheckedChange={(v) => setIsPrivate(v === true)} />
              <span>
                Riêng tư{' '}
                <span className="text-muted-foreground">(chỉ bạn, admin và người xác nhận thấy)</span>
              </span>
            </label>
          </div>

          <p className="text-muted-foreground text-xs">
            Trang: <span className="font-mono">{page.url}</span>
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Huỷ
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={busy || paste.uploading}>
            {busy ? <Spinner size={14} /> : <Send aria-hidden />} Gửi góp ý
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function Chip({
  active,
  onClick,
  children,
  title,
  tone,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  title?: string
  tone?: 'stop'
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'h-7 rounded-full px-3 text-xs font-medium',
        active
          ? tone === 'stop'
            ? 'border-[var(--stop)] bg-[color-mix(in_srgb,var(--stop)_12%,transparent)] text-[var(--stop)] hover:bg-[color-mix(in_srgb,var(--stop)_12%,transparent)]'
            : 'border-[var(--primary)] bg-[var(--accent)] text-[var(--primary)] hover:bg-[var(--accent)]'
          : 'text-muted-foreground',
      )}
    >
      {children}
    </Button>
  )
}
