'use client'

import { useRef, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { formatBytes } from '@/lib/file-limits'
import { extLabel, isImageMime, pickTaskFiles } from '@/lib/task-files'
import { MAX_TASK_FILES } from '@/lib/task-flow'
import { uploadFileTracked } from '@/lib/upload'
import type { TaskFileItem } from '@/modules/core/files/files.service'
import { dmVn } from './phan-cong.shared'

/**
 * TỆP ĐÍNH KÈM TRÊN VIỆC — khối trong ngăn phải (bản vẽ 3, lối ERP không kit; kiểu ở
 * `phan-cong.css`). Ảnh: ô vuông 4 cột; tài liệu: dòng phẳng (đuôi · tên · dung lượng ·
 * ai tải). Chọn tệp, kéo thả, dán ảnh (Ctrl+V) đi chung một đường. Mỗi tệp một kết
 * quả: tệp lỗi báo ngay trên dòng của nó, không chặn tệp khác. Xoá hai bước, chỉ tệp
 * của chính mình (hoặc sếp). Tải lên qua `uploadFileTracked` (init → PUT → finalize).
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
  const [loi, setLoi] = useState<string | null>(null)
  const [hoiXoa, setHoiXoa] = useState<string | null>(null)

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
    setLoi(null)
    try {
      const { url } = await api<{ url: string }>(
        `/api/files/${id}${download ? '?download=1' : ''}`,
      )
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setLoi(apiErrorText(e))
    }
  }

  async function remove(id: string) {
    setLoi(null)
    try {
      await api(`/api/files/${id}`, { method: 'DELETE' })
      setHoiXoa(null)
      onChanged()
    } catch (e) {
      setLoi(apiErrorText(e))
    }
  }

  const images = files.filter((f) => f.thumb)
  const docs = files.filter((f) => !f.thumb)

  const xoa = (f: TaskFileItem) =>
    f.can_delete &&
    (hoiXoa === f.id ? (
      <>
        <button type="button" className="ic del on" onClick={() => remove(f.id)}>
          Xoá hẳn
        </button>
        <button type="button" className="ic" onClick={() => setHoiXoa(null)}>
          Giữ
        </button>
      </>
    ) : (
      <button
        type="button"
        className="ic del"
        aria-label={`Xoá ${f.filename}`}
        onClick={() => setHoiXoa(f.id)}
      >
        Xoá
      </button>
    ))

  return (
    <section
      className="blk"
      aria-label="Tệp đính kèm"
      onPaste={(e) => {
        if (!canAdd || full) return
        const imgs = [...e.clipboardData.files]
        if (imgs.length > 0) {
          e.preventDefault()
          void add(imgs)
        }
      }}
    >
      <h2>
        <span>Tệp đính kèm</span>
        <span className="num">
          {files.length} / {MAX_TASK_FILES}
        </span>
      </h2>

      {images.length > 0 && (
        <div className="files">
          {images.map((f) => (
            <div key={f.id} className="th">
              <button
                type="button"
                aria-label={`Xem ảnh ${f.filename}`}
                onClick={() => open(f.id, false)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh có chữ ký sẵn, không qua trình tối ưu */}
                <img src={f.thumb!} alt={f.filename} loading="lazy" />
              </button>
              <div
                className="n"
                title={`${f.filename} · ${f.owner_name ?? ''} ${dmVn(f.created_at)}`}
              >
                <span>{f.filename}</span>
                {xoa(f)}
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.map((f) => (
        <div key={f.id} className="fl">
          <span className="x">{extLabel(f.filename)}</span>
          <button
            type="button"
            className="ten"
            title={`${f.filename} · ${f.owner_name ?? 'không rõ'}, ${dmVn(f.created_at)}`}
            onClick={() => open(f.id, false)}
          >
            {f.filename}
          </button>
          <span className="num mut">{formatBytes(f.size_bytes)}</span>
          <span>
            <button
              type="button"
              className="ic"
              aria-label={`Tải ${f.filename}`}
              onClick={() => open(f.id, true)}
            >
              Tải
            </button>
            {xoa(f)}
          </span>
        </div>
      ))}

      {uploads.map((u) => (
        <div key={u.key} className={u.error ? 'fl bad' : 'fl'}>
          <span className="x">{extLabel(u.name)}</span>
          <span className="ten" title={u.error ? `${u.name} · ${u.error}` : u.name}>
            {u.error ? `${u.name} · ${u.error}` : u.name}
          </span>
          <span className="num mut">{u.error ? '' : `${u.pct}%`}</span>
          <span>
            {u.error && (
              <button
                type="button"
                className="ic"
                aria-label={`Bỏ thông báo lỗi của ${u.name}`}
                onClick={() => setUploads((x) => x.filter((y) => y.key !== u.key))}
              >
                Bỏ
              </button>
            )}
          </span>
        </div>
      ))}

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
            aria-disabled={full}
            className={over ? 'add over' : 'add'}
            onClick={() => !full && inputRef.current?.click()}
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
          >
            {full ? (
              <span>Đã đủ {MAX_TASK_FILES} tệp — xoá bớt để thêm</span>
            ) : (
              <span>
                <b>Thêm tệp</b> · kéo thả · Ctrl+V dán ảnh
              </span>
            )}
          </button>
        </>
      ) : (
        blockReason && <p className="txt mut">{blockReason}</p>
      )}
      {!canAdd && !blockReason && files.length === 0 && (
        <p className="txt mut">Chưa có tệp.</p>
      )}
      {loi && (
        <p role="alert" className="txt bad-t">
          {loi}
        </p>
      )}
    </section>
  )
}
