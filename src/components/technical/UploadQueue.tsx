'use client'

import { AlertCircle, Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { DOC_TYPE_LABEL, formatBytes, type DocType } from '@/lib/file-limits'
import { cn } from '@/lib/utils'

/** Một file đang chờ / đang lên / đã xong trong hàng đợi. */
export type QueueItem = {
  /** Khoá cục bộ — file chưa có id server nên không dùng id được. */
  key: string
  file: File
  docType: DocType
  status: 'cho' | 'dang-tai' | 'xong' | 'loi'
  percent: number
  error?: string
}

/**
 * HÀNG ĐỢI UPLOAD — nhiều file một lượt, mỗi file một dòng có % thật.
 *
 * Ba điều bản một-file-một-lượt cũ không làm được:
 *   · thả 10 file rồi đi pha cà phê (trước: chọn file → chờ → chọn tiếp);
 *   · SỬA LOẠI trước khi lưu — đoán theo đuôi file sai thì chỉnh ngay tại đây,
 *     không phải tải lên rồi mới phát hiện nằm nhầm ngăn;
 *   · một file hỏng không kéo cả mẻ chết theo — nó ở lại hàng đợi với lý do
 *     riêng, các file khác vẫn lên.
 */
export function UploadQueue({
  items,
  docTypes,
  busy,
  onChangeType,
  onRemove,
  onStart,
  onClear,
}: {
  items: QueueItem[]
  /** Các loại được phép chọn ở panel này (khớp TAB của hồ sơ). */
  docTypes: readonly DocType[]
  busy: boolean
  onChangeType: (key: string, t: DocType) => void
  onRemove: (key: string) => void
  onStart: () => void
  onClear: () => void
}) {
  if (items.length === 0) return null

  const waiting = items.filter((i) => i.status === 'cho')
  const failed = items.filter((i) => i.status === 'loi')
  const totalBytes = waiting.reduce((s, i) => s + i.file.size, 0)

  return (
    <div className="bg-muted/30 border-b">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <span className="text-sm font-medium">
          {waiting.length > 0
            ? `${waiting.length} file chờ tải lên · ${formatBytes(totalBytes)}`
            : busy
              ? 'Đang tải lên…'
              : 'Đã xử lý xong'}
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
            {waiting.length > 0 ? 'Bỏ hết' : 'Đóng'}
          </Button>
          {waiting.length > 0 && (
            <Button size="sm" onClick={onStart} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Tải lên {waiting.length} file
            </Button>
          )}
        </div>
      </div>

      <ul className="divide-border/60 divide-y">
        {items.map((i) => (
          <li key={i.key} className="flex items-center gap-3 px-4 py-2">
            <span className="w-5 shrink-0">
              {i.status === 'dang-tai' && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {i.status === 'xong' && (
                <Check className="size-4 text-emerald-600" aria-hidden />
              )}
              {i.status === 'loi' && (
                <AlertCircle className="text-destructive size-4" aria-hidden />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{i.file.name}</div>
              <div className="text-muted-foreground text-xs">
                {formatBytes(i.file.size)}
                {i.status === 'dang-tai' && ` · ${i.percent}%`}
                {i.status === 'xong' && ' · đã lưu'}
              </div>
              {i.status === 'dang-tai' && (
                <div className="bg-border mt-1 h-1 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full transition-[width] duration-200"
                    style={{ width: `${i.percent}%` }}
                  />
                </div>
              )}
              {i.error && (
                <div className="text-destructive mt-0.5 text-xs">{i.error}</div>
              )}
            </div>

            {/* Đổi loại CHỈ khi còn chờ — file đã lưu thì loại đã chốt trong DB. */}
            {i.status === 'cho' ? (
              <select
                value={i.docType}
                onChange={(e) => onChangeType(i.key, e.target.value as DocType)}
                disabled={busy}
                aria-label={`Loại tài liệu cho ${i.file.name}`}
                className="bg-card shrink-0 rounded-md border px-2 py-1 text-xs"
              >
                {docTypes.map((t) => (
                  <option key={t} value={t}>
                    {DOC_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            ) : (
              <span
                className={cn(
                  'text-muted-foreground shrink-0 text-xs',
                  i.status === 'loi' && 'text-destructive',
                )}
              >
                {DOC_TYPE_LABEL[i.docType]}
              </span>
            )}

            {i.status !== 'dang-tai' && (
              <button
                type="button"
                onClick={() => onRemove(i.key)}
                aria-label={`Bỏ ${i.file.name} khỏi hàng đợi`}
                className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>

      {failed.length > 0 && !busy && (
        <p className="text-muted-foreground px-4 pb-2 text-xs">
          {failed.length} file không lên được — sửa rồi thả lại, các file khác đã lưu
          xong.
        </p>
      )}
    </div>
  )
}
