'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { uploadFile, type UploadParent } from '@/lib/upload'

export type PastedImage = {
  /** id file trên server (sau khi tải xong). */
  id: string | null
  /** URL xem tại chỗ (object URL) — thu hồi khi gỡ. */
  preview: string
  name: string
  uploading: boolean
  error: string | null
}

/**
 * DÁN ẢNH CHỤP MÀN HÌNH (Ctrl+V) / kéo thả / chọn file → tải lên ngay, giữ
 * danh sách id để gửi kèm góp ý hoặc dòng trao đổi.
 *
 * Ảnh dán vào HỘP GHI NHANH được tải với parent `none` (góp ý chưa tồn tại);
 * server gắn lại vào góp ý lúc lưu (`claimForFeedback`). Trong luồng trao đổi
 * thì parent là chính góp ý. Ảnh đi qua `uploadFile(..., 'image')` nên được
 * thu nhỏ ≤ 2560px trước khi tải — ảnh chụp 4K dán vào vẫn lọt trần.
 */
export function useImagePaste(parent: UploadParent, max = 6) {
  const [images, setImages] = useState<PastedImage[]>([])
  const previews = useRef<string[]>([])

  useEffect(() => {
    const urls = previews.current
    return () => {
      for (const u of urls) URL.revokeObjectURL(u)
    }
  }, [])

  const addFiles = useCallback(
    async (files: File[]) => {
      const pics = files.filter((f) => f.type.startsWith('image/'))
      if (pics.length === 0) return
      const room = Math.max(0, max - images.length)
      const batch = pics.slice(0, room)
      const fresh: PastedImage[] = batch.map((f) => {
        const preview = URL.createObjectURL(f)
        previews.current.push(preview)
        return {
          id: null,
          preview,
          name: f.name || 'anh-dan.png',
          uploading: true,
          error: null,
        }
      })
      setImages((prev) => [...prev, ...fresh])
      await Promise.all(
        batch.map(async (f, i) => {
          const key = fresh[i].preview
          try {
            const named =
              f.name && f.name !== 'image.png'
                ? f
                : new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type })
            const id = await uploadFile(named, parent, 'attachments', 'image')
            setImages((prev) =>
              prev.map((p) => (p.preview === key ? { ...p, id, uploading: false } : p)),
            )
          } catch (e) {
            setImages((prev) =>
              prev.map((p) =>
                p.preview === key
                  ? { ...p, uploading: false, error: e instanceof Error ? e.message : 'Tải lên lỗi' }
                  : p,
              ),
            )
          }
        }),
      )
    },
    [images.length, max, parent],
  )

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
      if (files.some((f) => f.type.startsWith('image/'))) {
        e.preventDefault()
        void addFiles(files)
      }
    },
    [addFiles],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) {
        e.preventDefault()
        void addFiles(files)
      }
    },
    [addFiles],
  )

  const remove = useCallback((preview: string) => {
    setImages((prev) => prev.filter((p) => p.preview !== preview))
    URL.revokeObjectURL(preview)
  }, [])

  const reset = useCallback(() => setImages([]), [])

  return {
    images,
    addFiles,
    onPaste,
    onDrop,
    remove,
    reset,
    uploading: images.some((i) => i.uploading),
    ids: images.map((i) => i.id).filter((x): x is string => !!x),
  }
}
