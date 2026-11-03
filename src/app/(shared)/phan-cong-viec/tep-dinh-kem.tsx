'use client'

import { useRef, useState } from 'react'
import { Download, Paperclip, Trash2, X } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { formatBytes } from '@/lib/file-limits'
import { dmVn } from './phan-cong.shared'
import { extLabel, isImageMime, pickTaskFiles } from '@/lib/task-files'
import { MAX_TASK_FILES } from '@/lib/task-flow'
import { uploadFileTracked } from '@/lib/upload'
import type { TaskFileItem } from '@/modules/core/files/files.service'

/**
 * TỆP ĐÍNH KÈM TRÊN VIỆC (bản vẽ 2, B2 — 03/11/2026): ảnh hiện thumbnail, tài liệu
 * hiện dòng (đuôi + tên + dung lượng + ai tải). Chọn tệp, kéo thả hoặc dán ảnh
 * (Ctrl+V) đều vào cùng một đường. Mỗi tệp một kết quả: tệp lỗi báo ngay trên tệp
 * đó, không chặn các tệp còn lại. Xoá chỉ hiện với tệp của chính mình (hoặc sếp).
 *
 * VIẾT THẲNG Tailwind + token theme, không dùng kit. Tải lên đi qua
 * `uploadFileTracked` (init → PUT → finalize) như mọi tệp khác của hệ thống.
 */

type Upload = { key: number; name: string; pct: number; error: string | null }

const ZONE_ID = 'tep-dinh-kem-input'

export function TepDinhKem({
  taskId,
  files,
  canAdd,
  blockReason,
  onChanged,
}: {
  taskId: string
  files: TaskFileItem[]
  /** Người xem đính được tệp (người giao / người nhận / sếp, việc còn mở). */
  canAdd: boolean
  /** Khi không đính được: câu nói vì sao + cách gỡ. */
  blockReason?: string | null
  /** Sau khi tải lên / xoá xong — màn cha tải lại danh sách. */
  onChanged: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const [uploads, setUploads] = useState<Upload[]>([])
  const [over, setOver] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const full = files.length >= MAX_TASK_FILES
  const patch = (key: number, p: Partial<Upload>) =>
    setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)))

  async function add(picked: File[]) {
    if (picked.length === 0) return
    const { accepted, rejected } = pickTaskFiles(picked, files.length)
    const bad: Upload[] = rejected.map((r) => ({
      key: ++seq.current,
      name: r.name,
      pct: 0,
      error: r.reason,
    }))
    const good = accepted.map((f) => ({ f, key: ++seq.current }))
    setUploads((u) => [
      ...u.filter((x) => x.error === null),
      ...bad,
      ...good.map(({ f, key }) => ({ key, name: f.name, pct: 0, error: null })),
    ])
    let uploaded = 0
    for (const { f, key } of good) {
      try {
        await uploadFileTracked(
          f,
          { kind: 'task', id: taskId },
          'attachments',
          isImageMime(f.type) ? 'image' : null,
          (pct) => patch(key, { pct }),
        )
        uploaded++
        setUploads((u) => u.filter((x) => x.key !== key))
      } catch (e) {
        patch(key, { error: apiErrorText(e) })
      }
    }
    if (uploaded > 0) onChanged()
  }

  async function open(id: string, download: boolean) {
    try {
      const { url } = await api<{ url: string }>(
        `/api/files/${id}${download ? '?download=1' : ''}`,
      )
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setDelErr(apiErrorText(e))
    }
  }

  async function remove(id: string) {
    setDelErr(null)
    try {
      await api(`/api/files/${id}`, { method: 'DELETE' })
      setConfirmDel(null)
      onChanged()
    } catch (e) {
      setDelErr(apiErrorText(e))
    }
  }

  const images = files.filter((f) => f.thumb)
  const docs = files.filter((f) => !f.thumb)

  return (
    <div
      className="flex flex-col gap-2"
      onPaste={(e) => {
        if (!canAdd || full) return
        const imgs = [...e.clipboardData.files]
        if (imgs.length > 0) {
          e.preventDefault()
          void add(imgs)
        }
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-semibold text-[var(--foreground)]">
          Tệp đính kèm
        </span>
        <span className="font-mono text-[12px] text-[var(--muted-foreground)] tabular-nums">
          {files.length} / {MAX_TASK_FILES}
        </span>
      </div>

      {canAdd ? (
        <>
          <input
            ref={inputRef}
            id={ZONE_ID}
            type="file"
            multiple
            hidden
            disabled={full}
            onChange={(e) => {
              void add([...(e.currentTarget.files ?? [])])
              e.currentTarget.value = ''
            }}
          />
          <button
            type="button"
            disabled={full}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              if (!full) void add([...e.dataTransfer.files])
            }}
            className={`flex items-center gap-2 border border-dashed px-3 py-2.5 text-left text-[12px] ${
              full
                ? 'cursor-not-allowed border-[var(--border)] bg-[var(--muted)] text-[var(--muted-foreground)]'
                : over
                  ? 'border-[var(--primary)] bg-[var(--accent)] text-[var(--foreground)]'
                  : 'border-[var(--muted-foreground)] bg-[var(--card)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
            }`}
          >
            <Paperclip size={16} aria-hidden />
            {full ? (
              <span>Đã đủ {MAX_TASK_FILES} tệp — xoá bớt để thêm</span>
            ) : (
              <span>
                <b className="text-[var(--primary)]">Chọn tệp</b>, kéo thả vào đây, hoặc
                dán ảnh bằng Ctrl+V
              </span>
            )}
          </button>
        </>
      ) : blockReason ? (
        <p className="text-[12px] text-[var(--muted-foreground)]">{blockReason}</p>
      ) : null}

      {uploads.length > 0 && (
        <ul className="flex flex-col border border-[var(--border)] bg-[var(--card)]">
          {uploads.map((u) => (
            <li
              key={u.key}
              className="flex items-center gap-2 border-b border-[var(--border)] px-2 py-1.5 text-[12px] last:border-b-0"
            >
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {u.name}
                {u.error ? (
                  <span className="block text-[var(--stop)]">{u.error}</span>
                ) : null}
              </span>
              {u.error ? (
                <button
                  type="button"
                  aria-label={`Bỏ thông báo lỗi của ${u.name}`}
                  className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
                >
                  <X size={14} aria-hidden />
                </button>
              ) : (
                <span className="font-mono text-[var(--muted-foreground)] tabular-nums">
                  {u.pct}%
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {images.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
          {images.map((f) => (
            <li
              key={f.id}
              className="flex min-w-0 flex-col border border-[var(--border)] bg-[var(--card)]"
            >
              <button
                type="button"
                aria-label={`Xem ảnh ${f.filename}`}
                onClick={() => open(f.id, false)}
                className="flex h-16 items-center justify-center overflow-hidden bg-[var(--muted)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh có chữ ký sẵn, không qua trình tối ưu */}
                <img
                  src={f.thumb!}
                  alt={f.filename}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </button>
              <span className="px-1.5 pt-1 text-[11.5px] leading-tight [overflow-wrap:anywhere]">
                {f.filename}
              </span>
              <FileMeta
                f={f}
                confirm={confirmDel === f.id}
                onAsk={() => setConfirmDel(f.id)}
                onCancel={() => setConfirmDel(null)}
                onDelete={() => remove(f.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {docs.length > 0 && (
        <ul className="flex flex-col border border-[var(--border)] bg-[var(--card)]">
          {docs.map((f) => (
            <li
              key={f.id}
              className="grid grid-cols-[34px_1fr_auto] items-center gap-2 border-b border-[var(--border)] px-2 py-1.5 last:border-b-0"
            >
              <span className="flex h-[22px] items-center justify-center bg-[var(--muted-foreground)] font-mono text-[10px] font-bold text-[var(--card)]">
                {extLabel(f.filename)}
              </span>
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => open(f.id, false)}
                  className="text-left text-[12.5px] [overflow-wrap:anywhere] hover:text-[var(--primary)]"
                >
                  {f.filename}
                </button>
                <FileMeta
                  f={f}
                  inline
                  confirm={confirmDel === f.id}
                  onAsk={() => setConfirmDel(f.id)}
                  onCancel={() => setConfirmDel(null)}
                  onDelete={() => remove(f.id)}
                />
              </div>
              <button
                type="button"
                aria-label={`Tải ${f.filename}`}
                onClick={() => open(f.id, true)}
                className="text-[var(--muted-foreground)] hover:text-[var(--primary)]"
              >
                <Download size={15} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {files.length === 0 && uploads.length === 0 && !canAdd && !blockReason && (
        <p className="text-[12px] text-[var(--muted-foreground)]">
          Việc này chưa có tệp đính kèm.
        </p>
      )}
      {delErr && (
        <p role="alert" className="text-[12px] text-[var(--stop)]">
          {delErr}
        </p>
      )}
    </div>
  )
}

/** Dung lượng · người tải · ngày — và nút xoá (hai bước, xác nhận ngay dưới tệp). */
function FileMeta({
  f,
  inline,
  confirm,
  onAsk,
  onCancel,
  onDelete,
}: {
  f: TaskFileItem
  inline?: boolean
  confirm: boolean
  onAsk: () => void
  onCancel: () => void
  onDelete: () => void
}) {
  const who = f.owner_name ?? 'không rõ'
  return (
    <span
      className={`flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] ${inline ? '' : 'px-1.5 pb-1'}`}
    >
      <span className="font-mono tabular-nums">{formatBytes(f.size_bytes)}</span>
      <span>
        · {who}, {dmVn(f.created_at)}
      </span>
      {f.can_delete &&
        (confirm ? (
          <span className="ml-auto flex items-center gap-1.5">
            <span
              role="button"
              tabIndex={0}
              className="font-semibold text-[var(--stop)]"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              onKeyDown={(e) => e.key === 'Enter' && onDelete()}
            >
              Xoá hẳn
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                onCancel()
              }}
              onKeyDown={(e) => e.key === 'Enter' && onCancel()}
            >
              Giữ
            </span>
          </span>
        ) : (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Xoá ${f.filename}`}
            className="ml-auto hover:text-[var(--stop)]"
            onClick={(e) => {
              e.stopPropagation()
              onAsk()
            }}
            onKeyDown={(e) => e.key === 'Enter' && onAsk()}
          >
            <Trash2 size={13} aria-hidden />
          </span>
        ))}
    </span>
  )
}
