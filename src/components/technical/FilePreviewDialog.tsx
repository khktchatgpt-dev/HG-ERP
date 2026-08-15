'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Button } from '@/components/shadcn/button'
import { api, apiErrorText } from '@/lib/api'
import { formatBytes } from '@/lib/file-limits'
import type { ProductFile } from './product-files'

/**
 * XEM TRƯỚC ngay trong trang — ảnh và PDF nhúng thẳng, phần còn lại thì nói rõ
 * là phải tải về.
 *
 * Vì sao đáng làm: hồ sơ có 540 file BOM tên na ná nhau ("BKQC - Sofa set...",
 * "BKQC - Ghế Xoay..."). Không xem trước thì mỗi lần tìm đúng file là một lần
 * tải về, mở Excel, đóng lại. Bản xem trước đầy đủ (đọc .xlsx bằng SheetJS) đã
 * từng dựng rồi bỏ 13/08/2026 — bản này chỉ làm phần rẻ và chắc chắn: ảnh + PDF
 * bằng thẻ có sẵn của trình duyệt, không thêm thư viện nào.
 */
export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: ProductFile | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        {/* Thân chỉ MOUNT khi có file, và `key` ép dựng lại khi đổi file — nhờ
            vậy không cần effect nào đi dọn state của file trước. */}
        {file && <PreviewBody key={file.id} file={file} />}
      </DialogContent>
    </Dialog>
  )
}

function PreviewBody({ file }: { file: ProductFile }) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api<{ url: string }>(`/api/files/${file.id}`)
      .then((r) => {
        if (alive) setUrl(r.url)
      })
      .catch((e) => {
        if (alive) setError(apiErrorText(e))
      })
    return () => {
      alive = false
    }
  }, [file.id])

  const isImage = file.mime_type.startsWith('image/')
  const isPdf = file.mime_type === 'application/pdf'
  const canPreview = isImage || isPdf

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate">{file.filename}</DialogTitle>
        <DialogDescription>
          {formatBytes(file.size_bytes)}
          {file.owner_name && ` · ${file.owner_name}`}
          {` · ${new Date(file.created_at).toLocaleDateString('vi-VN')}`}
        </DialogDescription>
      </DialogHeader>

      <div className="bg-muted/30 flex min-h-64 items-center justify-center rounded-lg border">
        {error ? (
          <p className="text-destructive p-6 text-sm">{error}</p>
        ) : !canPreview ? (
          <div className="text-muted-foreground p-8 text-center text-sm">
            <FileText className="mx-auto mb-2 size-8" aria-hidden />
            <p>Định dạng này không xem trước được trong trang.</p>
            <p className="mt-0.5 text-xs">Tải về để mở bằng Excel / PowerPoint / CAD.</p>
          </div>
        ) : !url ? (
          <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden />
        ) : isImage ? (
          // Ảnh xem trước đi thẳng từ Storage: URL đã ký, và next/image không
          // thêm được gì ở đây ngoài một vòng tối ưu lại ảnh vốn đã có sẵn.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={file.filename}
            className="max-h-[70vh] w-auto object-contain"
          />
        ) : (
          <iframe
            src={url}
            title={file.filename}
            className="h-[70vh] w-full rounded-lg"
          />
        )}
      </div>

      <div className="flex justify-end">
        {url ? (
          <Button variant="outline" asChild>
            <a href={url} target="_blank" rel="noopener">
              <Download className="size-4" aria-hidden />
              Tải về
            </a>
          </Button>
        ) : (
          <Button variant="outline" disabled>
            <Download className="size-4" aria-hidden />
            Tải về
          </Button>
        )}
      </div>
    </>
  )
}
