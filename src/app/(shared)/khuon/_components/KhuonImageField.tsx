'use client'

import { useRef } from 'react'
import {
  AlertTriangle,
  ClipboardPaste,
  ImagePlus,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { formatBytes } from '@/lib/file-limits'
import { cn } from '@/lib/utils'

/**
 * Ô ẢNH MẶT CẮT trong form thêm / sửa khuôn (artboard 20 · 20b, duyệt 29/09/2026).
 *
 * Ô này chỉ VẼ. Ảnh vào bằng ba đường — dán Ctrl+V ở bất kỳ đâu trong hộp, kéo
 * thả vào hộp, bấm "Chọn ảnh…" — và cả ba đổ về MỘT hàm `take` của form, nên
 * luật soát file chỉ nằm một chỗ. Ảnh chỉ tải lên khi bấm nút lưu của form:
 * khuôn MỚI chưa có id thì chưa có chỗ để đính file vào.
 */

/** Ảnh trong form. `current`/`removed` chỉ có khi SỬA một khuôn đã có ảnh. */
export type DieImage =
  | { kind: 'none' }
  | { kind: 'current'; url: string }
  | { kind: 'new'; file: File; url: string; pasted: boolean }
  | { kind: 'removed'; url: string }

export const DIE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']

/**
 * Tên file khi tải lên. Ảnh DÁN từ bộ nhớ tạm trình duyệt nào cũng đặt là
 * "image.png" — trên kho file không ai biết đó là khuôn nào, nên đặt lại theo
 * mã. File người dùng tự chọn thì giữ tên họ đặt.
 */
export function dieImageName(img: Extract<DieImage, { kind: 'new' }>, code: string) {
  if (!img.pasted) return img.file.name
  const ext = img.file.type === 'image/jpeg' ? 'jpg' : img.file.type.split('/')[1]
  const base = code.trim().replace(/[\\/:*?"<>|\s]+/g, '-') || 'khuon'
  return `${base}-mat-cat.${ext}`
}

export function KhuonImageField({
  value,
  code,
  saveLabel,
  dragging,
  error,
  disabled,
  onPick,
  onClear,
  onUndoRemove,
}: {
  value: DieImage
  /** Mã đang gõ — để hiện đúng tên file sẽ lưu cho ảnh dán. */
  code: string
  /** Tên nút sẽ đẩy ảnh lên — đổi theo trạng thái hộp ("Tải lại ảnh" khi nhịp ảnh vừa hỏng). */
  saveLabel: string
  /** Đang có file kéo ngang qua HỘP (form theo dõi, không phải riêng ô này). */
  dragging: boolean
  error: string | null
  disabled: boolean
  onPick: (file: File) => void
  onClear: () => void
  onUndoRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showing = value.kind === 'current' || value.kind === 'new' ? value : null

  const picker = (
    // Ô chọn file đứng ẩn — trình duyệt không cho tạo kiểu nút chọn file mặc định.
    <Input
      ref={inputRef}
      type="file"
      accept={DIE_IMAGE_TYPES.join(',')}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0]
        if (f) onPick(f)
        e.target.value = ''
      }}
    />
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        Ảnh mặt cắt <span className="opacity-80">· không bắt buộc</span>
      </span>
      {picker}

      {showing && !dragging ? (
        <>
          <div className="bg-card flex h-[150px] items-center justify-center rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element -- ảnh blob chưa tải lên / ảnh khổ gốc, không qua trình tối ưu */}
            <img
              src={showing.url}
              alt="Mặt cắt khuôn"
              className="max-h-[136px] max-w-[94%] object-contain"
            />
          </div>
          <div className="text-muted-foreground flex justify-between gap-2 text-[11px]">
            {showing.kind === 'new' ? (
              <>
                <span className="t-data truncate">{dieImageName(showing, code)}</span>
                <span className="t-data shrink-0">{formatBytes(showing.file.size)}</span>
              </>
            ) : (
              <span>Ảnh đang dùng trên hồ sơ</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus /> Đổi ảnh
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={disabled}
              onClick={onClear}
            >
              <Trash2 /> Bỏ
            </Button>
          </div>
          {showing.kind === 'new' && (
            <span className="text-muted-foreground text-[11px]">
              tải lên khi bấm {saveLabel}
            </span>
          )}
        </>
      ) : (
        <>
          <div
            className={cn(
              'flex h-[150px] flex-col items-center justify-center gap-1.5 rounded-lg border-dashed p-2.5 text-center',
              dragging
                ? 'border-primary bg-accent text-accent-foreground border-2'
                : 'bg-background border-input text-muted-foreground border-[1.5px]',
            )}
          >
            {dragging ? (
              <>
                <Upload className="size-4" aria-hidden />
                <span className="text-[13px] font-semibold">
                  Thả để gắn làm ảnh mặt cắt
                </span>
              </>
            ) : (
              <>
                <ClipboardPaste className="size-4" aria-hidden />
                <span className="text-foreground text-[13px] font-semibold">
                  Dán ảnh — Ctrl+V
                </span>
                <span className="text-xs">hoặc kéo thả file vào đây</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-0.5 h-7"
                  disabled={disabled}
                  onClick={() => inputRef.current?.click()}
                >
                  <ImagePlus /> Chọn ảnh…
                </Button>
              </>
            )}
          </div>
          <span className="text-muted-foreground text-[11px]">
            PNG · JPG · WebP · tối đa 5 MB
          </span>
          {value.kind === 'removed' && (
            <span className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-[11px]">
              Ảnh cũ sẽ bỏ khỏi hồ sơ khi bấm Lưu thay đổi.
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-[11px]"
                disabled={disabled}
                onClick={onUndoRemove}
              >
                <Undo2 /> Giữ lại
              </Button>
            </span>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-destructive flex items-start gap-1.5 text-xs">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}
