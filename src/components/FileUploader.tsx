'use client'

import { useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

type Parent =
  | { kind: 'task'; id: string }
  | { kind: 'comment'; id: string }
  | { kind: 'customer'; id: string }
  | { kind: 'invoice'; id: string }
  | { kind: 'product'; id: string }
  | { kind: 'none' }

type Bucket = 'private' | 'attachments' | 'public'

type InitResponse = {
  fileId: string
  uploadUrl: string
  token: string
  path: string
}

const MAX_BYTES = 10 * 1024 * 1024

async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function FileUploader({
  parent,
  bucket = 'attachments',
  accept,
  onUploaded,
  label = 'Tải tệp lên',
  computeChecksum = false,
}: {
  parent: Parent
  bucket?: Bucket
  accept?: string
  onUploaded?: (fileId: string) => void
  label?: string
  /** Compute sha256 client-side and post to finalize. Slows large files. Default off. */
  computeChecksum?: boolean
}) {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error('Tệp quá lớn', `Tối đa ${MAX_BYTES / 1024 / 1024} MB`)
      return
    }
    setBusy(true)
    setProgress('Đang khởi tạo upload…')
    try {
      const init = await api<InitResponse>('/api/files', {
        method: 'POST',
        body: {
          filename: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          bucket,
          parent,
        },
      })

      setProgress('Đang tải lên…')
      const putRes = await fetch(init.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`)

      setProgress('Đang hoàn tất…')
      const checksum = computeChecksum ? await sha256Hex(file) : undefined
      await api(`/api/files/${init.fileId}/finalize`, {
        method: 'POST',
        body: { checksum },
      })

      toast.success('Tải lên thành công', file.name)
      onUploaded?.(init.fileId)
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Lỗi không xác định'
      toast.error('Tải lên thất bại', msg)
    } finally {
      setBusy(false)
      setProgress(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          if (f) handleFile(f)
        }}
        className="hidden"
        id={`file-upload-${parent.kind}-${'id' in parent ? parent.id : 'none'}`}
      />
      <label
        htmlFor={`file-upload-${parent.kind}-${'id' in parent ? parent.id : 'none'}`}
        className={`cursor-pointer rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900 ${
          busy ? 'pointer-events-none opacity-50' : ''
        }`}
      >
        {busy ? progress ?? 'Đang xử lý…' : label}
      </label>
    </div>
  )
}
