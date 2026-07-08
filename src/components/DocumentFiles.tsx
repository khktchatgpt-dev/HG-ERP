'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { FileUploader } from '@/components/FileUploader'

/** File gốc đính theo chứng từ Sales/SX (báo giá / đơn hàng / LSX). */
type DocFile = {
  id: string
  filename: string
  mime_type: string
  size_bytes: number
  created_at: string
}

type Kind = 'quote' | 'sales_order' | 'production_order'

const QUERY_PARAM: Record<Kind, string> = {
  quote: 'quote_id',
  sales_order: 'sales_order_id',
  production_order: 'production_order_id',
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼'
  if (mime === 'application/pdf') return '📄'
  if (mime.includes('spreadsheet') || mime.includes('excel') || mime === 'text/csv')
    return '📊'
  if (mime.includes('word')) return '📝'
  if (mime.includes('zip')) return '🗜'
  return '📎'
}

export function DocumentFiles({
  kind,
  id,
  canEdit,
  title = 'File đính kèm',
}: {
  kind: Kind
  id: string
  canEdit: boolean
  title?: string
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [files, setFiles] = useState<DocFile[]>([])
  const param = QUERY_PARAM[kind]

  const load = useCallback(async () => {
    try {
      const data = await api<{ files: DocFile[] }>(`/api/files?${param}=${id}`)
      setFiles(data.files)
    } catch {
      /* danh sách file lỗi không chặn xem chứng từ */
    }
  }, [param, id])

  useEffect(() => {
    // load() là async — setState chạy trong callback đã resolve, không đồng bộ.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function download(f: DocFile) {
    try {
      const { url } = await api<{ url: string }>(`/api/files/${f.id}`)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error('Không tải được file', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  async function remove(f: DocFile) {
    const ok = await confirm({
      title: `Xoá file "${f.filename}"?`,
      description: 'File sẽ bị gỡ khỏi chứng từ.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    try {
      await api(`/api/files/${f.id}`, { method: 'DELETE' })
      toast.success('Đã xoá file', f.filename)
      void load()
    } catch (e) {
      toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500 uppercase">
          {title} ({files.length})
        </span>
        {canEdit && (
          <FileUploader
            parent={{ kind, id }}
            bucket="attachments"
            label="+ Tải file gốc"
            onUploaded={() => void load()}
          />
        )}
      </div>
      {files.length === 0 ? (
        <p className="py-2 text-center text-xs text-zinc-400">
          Chưa có file — tải bản gốc (PDF/Excel/scan) lên để lưu vào hồ sơ.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-1.5 text-sm">
              <span aria-hidden>{fileIcon(f.mime_type)}</span>
              <button
                onClick={() => void download(f)}
                className="min-w-0 flex-1 truncate text-left text-sky-600 hover:underline dark:text-sky-400"
                title={f.filename}
              >
                {f.filename}
              </button>
              <span className="shrink-0 text-xs text-zinc-400">
                {fmtSize(f.size_bytes)} ·{' '}
                {new Date(f.created_at).toLocaleDateString('vi-VN')}
              </span>
              {canEdit && (
                <button
                  onClick={() => void remove(f)}
                  className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  aria-label="Xoá file"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
