'use client'

/* eslint-disable @next/next/no-img-element -- ảnh chụp màn hình qua signed URL ngắn hạn, không qua next/image */

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { Dialog, DialogContent, DialogTitle } from '@/components/shadcn/dialog'
import { Button } from '@/components/shadcn/button'
import { cn } from '@/lib/utils'
import type { PastedImage } from './useImagePaste'

const urlCache = new Map<string, string>()

/** URL xem của một file — gọi `/api/files/[id]` một lần rồi nhớ theo tab. */
export function useFileUrl(id: string | null): string | null {
  const [url, setUrl] = useState<string | null>(id ? (urlCache.get(id) ?? null) : null)
  useEffect(() => {
    if (!id) return
    const hit = urlCache.get(id)
    if (hit) {
      // Đồng bộ với cache module — ngoại lệ hợp lệ của luật (nguồn ngoài React).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl(hit)
      return
    }
    let alive = true
    api<{ url: string }>(`/api/files/${id}`)
      .then((r) => {
        urlCache.set(id, r.url)
        if (alive) setUrl(r.url)
      })
      .catch(() => {
        /* ảnh lỗi thì ô trống, không chặn luồng */
      })
    return () => {
      alive = false
    }
  }, [id])
  return url
}

function Thumb({
  id,
  src,
  alt,
  size,
  onClick,
  onRemove,
  busy,
  error,
}: {
  id: string | null
  src?: string
  alt: string
  size: 'sm' | 'md'
  onClick?: () => void
  onRemove?: () => void
  busy?: boolean
  error?: string | null
}) {
  const fetched = useFileUrl(src ? null : id)
  const url = src ?? fetched
  const box = size === 'sm' ? 'h-12 w-16' : 'h-24 w-32'
  return (
    <div className={cn('bg-muted relative shrink-0 overflow-hidden rounded-md border', box)}>
      {url ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onClick}
          className="h-full w-full cursor-zoom-in rounded-none p-0 hover:bg-transparent"
          aria-label={`Xem ảnh ${alt}`}
        >
          <img src={url} alt={alt} className="h-full w-full object-cover" />
        </Button>
      ) : (
        <div className="text-muted-foreground grid h-full w-full place-items-center text-[10px]">
          {error ? 'Lỗi' : '…'}
        </div>
      )}
      {busy && (
        <div className="bg-card/70 absolute inset-0 grid place-items-center text-[10px]">
          Đang tải…
        </div>
      )}
      {error && (
        <div
          className="absolute inset-x-0 bottom-0 truncate bg-[var(--stop)] px-1 text-[9px] text-white"
          title={error}
        >
          {error}
        </div>
      )}
      {onRemove && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onRemove}
          aria-label="Gỡ ảnh"
          className="bg-card/90 absolute top-0.5 right-0.5 size-5 rounded-full"
        >
          <X className="size-3" aria-hidden />
        </Button>
      )}
    </div>
  )
}

/** Dải ảnh đã lưu (id file) — bấm phóng to. */
export function FeedbackImages({
  ids,
  size = 'sm',
  className,
}: {
  ids: string[]
  size?: 'sm' | 'md'
  className?: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  if (ids.length === 0) return null
  return (
    <>
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {ids.map((id, i) => (
          <Thumb
            key={id}
            id={id}
            alt={`kèm ${i + 1}/${ids.length}`}
            size={size}
            onClick={() => setOpen(id)}
          />
        ))}
      </div>
      <Lightbox id={open} onClose={() => setOpen(null)} />
    </>
  )
}

/** Dải ảnh ĐANG DÁN (chưa lưu vào góp ý) — có nút gỡ, trạng thái tải. */
export function PendingImages({
  images,
  onRemove,
}: {
  images: PastedImage[]
  onRemove: (preview: string) => void
}) {
  if (images.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {images.map((im) => (
        <Thumb
          key={im.preview}
          id={im.id}
          src={im.preview}
          alt={im.name}
          size="md"
          busy={im.uploading}
          error={im.error}
          onRemove={() => onRemove(im.preview)}
        />
      ))}
    </div>
  )
}

function Lightbox({ id, onClose }: { id: string | null; onClose: () => void }) {
  const url = useFileUrl(id)
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-2 sm:max-w-5xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Ảnh kèm góp ý</DialogTitle>
        {url && <img src={url} alt="ảnh kèm góp ý" className="max-h-[80dvh] w-full object-contain" />}
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
