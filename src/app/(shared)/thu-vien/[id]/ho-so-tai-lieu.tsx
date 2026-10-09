'use client'

import { useRef, useState } from 'react'
import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { DOC_TYPE_LABEL, type DocType } from '@/lib/file-limits'
import { uploadFileTracked } from '@/lib/upload'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { dmyShort, type HoSoView } from './ho-so.shared'
import type { HoSoCtx } from './useHoSo'

/** Loại tài liệu của HỒ SƠ SP (thứ tự hiện) — theo checklist: bản vẽ, BOM, đóng gói… */
const LOAI: DocType[] = [
  'drawing',
  'bom',
  'packing',
  'loading',
  'assembly',
  'sample_photo',
  'label',
  'cert',
  'approval',
  'video',
  'image',
  'other',
]

function kb(n: number): string {
  if (n >= 1024 * 1024)
    return `${(n / 1024 / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB`
  return `${Math.max(1, Math.round(n / 1024)).toLocaleString('vi-VN')} KB`
}

/**
 * TÀI LIỆU — bảng file theo loại (đúng loại trong checklist: Bản vẽ, BOM, Đóng
 * gói, Xếp cont…), tải lên có chọn loại, tải về, xoá. Không quét đĩa: file nằm
 * trong bảng `files` (app cũ có hai nguồn sự thật, đây là chỗ sửa).
 */
export function HoSoTaiLieu({
  d,
  c,
  canEdit,
}: {
  d: HoSoView
  c: HoSoCtx
  canEdit: boolean
}) {
  const confirm = useConfirm()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loai, setLoai] = useState<DocType>('drawing')
  const [tienDo, setTienDo] = useState<{ name: string; pct: number } | null>(null)
  const thieuBv = !d.files.some((f) => f.doc_type === 'drawing')

  async function taiLen(files: FileList | null) {
    if (!files?.length) return
    for (const f of Array.from(files)) {
      setTienDo({ name: f.name, pct: 0 })
      try {
        await uploadFileTracked(
          f,
          { kind: 'product', id: d.id },
          'attachments',
          loai,
          (pct) => setTienDo({ name: f.name, pct }),
        )
        c.toast.success('Đã tải lên', `${f.name} · ${DOC_TYPE_LABEL[loai]}`)
      } catch (e) {
        c.toast.error('Tải lên thất bại', e instanceof Error ? e.message : 'Có lỗi')
      }
    }
    setTienDo(null)
    if (inputRef.current) inputRef.current.value = ''
    c.router.refresh()
  }

  async function taiVe(id: string, name: string) {
    try {
      const r = await api<{ url: string }>(`/api/files/${id}?download=1`)
      window.open(r.url, '_blank', 'noopener')
    } catch (e) {
      c.toast.error('Không tải được file', e instanceof ApiError ? e.message : name)
    }
  }

  async function xoa(id: string, name: string) {
    const ok = await confirm({
      title: `Xoá file "${name}"?`,
      description: 'File bị xoá khỏi hồ sơ. Không hoàn tác được.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    try {
      await api(`/api/files/${id}`, { method: 'DELETE' })
      c.toast.success('Đã xoá', name)
      c.router.refresh()
    } catch (e) {
      c.toast.error('Xoá thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    }
  }

  const byLoai = new Map<string, HoSoView['files']>()
  for (const f of d.files) {
    const k = f.doc_type ?? 'other'
    byLoai.set(k, [...(byLoai.get(k) ?? []), f])
  }
  const order = [
    ...LOAI.filter((l) => byLoai.has(l)),
    ...[...byLoai.keys()].filter((k) => !LOAI.includes(k as DocType)),
  ]

  return (
    <section aria-label="Tài liệu" id="tai-lieu" className="panel">
      <h2 className="ph sec-tl">
        <span className="ic-sec">
          <FileText aria-hidden />
        </span>
        Tài liệu
        <span className="n">
          {d.files.length} file{thieuBv ? ' · thiếu bản vẽ' : ''}
        </span>
        {canEdit && c.suaDuoc && (
          <span className="r" style={{ alignItems: 'center' }}>
            <label htmlFor="tv-loai-file" className="sr">
              Loại tài liệu
            </label>
            <select
              id="tv-loai-file"
              className="pick"
              value={loai}
              onChange={(e) => setLoai(e.target.value as DocType)}
            >
              {LOAI.map((l) => (
                <option key={l} value={l}>
                  {DOC_TYPE_LABEL[l]}
                </option>
              ))}
            </select>
            <label className="btn" style={{ cursor: 'pointer' }} title="Tải tài liệu lên">
              <Upload size={14} aria-hidden />
              <span className="t">Tải lên</span>
              <input
                ref={inputRef}
                type="file"
                multiple
                className="sr"
                onChange={(e) => void taiLen(e.target.files)}
              />
            </label>
          </span>
        )}
      </h2>
      {tienDo && (
        <div className="notice" role="status">
          Đang tải {tienDo.name} … {tienDo.pct}%
        </div>
      )}
      {d.files.length === 0 ? (
        <div className="pad">
          Chưa có tài liệu nào.{' '}
          {canEdit
            ? 'Chọn loại rồi bấm Tải lên — bản vẽ và file BOM là hai thứ xưởng hỏi trước.'
            : ''}
        </div>
      ) : (
        <table aria-label="Tài liệu của sản phẩm">
          <thead>
            <tr>
              <th>Loại</th>
              <th>Tên file</th>
              <th className="num c-md">Dung lượng</th>
              <th className="c-md">Ngày</th>
              <th style={{ width: 60 }}>
                <span className="sr">Thao tác</span>
              </th>
            </tr>
          </thead>
          {order.map((k) => (
            <tbody key={k}>
              <tr className="grp">
                <th scope="rowgroup" colSpan={5}>
                  {DOC_TYPE_LABEL[k as DocType] ?? k}{' '}
                  <span className="n">{byLoai.get(k)?.length ?? 0} file</span>
                </th>
              </tr>
              {(byLoai.get(k) ?? []).map((f) => (
                <tr key={f.id}>
                  <td className="muted">
                    {f.mime_type.split('/')[1]?.toUpperCase().slice(0, 12)}
                  </td>
                  <td title={f.filename}>{f.filename}</td>
                  <td className="num c-md">{kb(f.size_bytes)}</td>
                  <td className="num c-md">{dmyShort(f.created_at)}</td>
                  <td>
                    <span style={{ display: 'inline-flex', gap: 4 }}>
                      <button
                        type="button"
                        className="btn sm"
                        onClick={() => void taiVe(f.id, f.filename)}
                        title="Tải về"
                        aria-label={`Tải về ${f.filename}`}
                      >
                        <Download size={13} aria-hidden />
                      </button>
                      {canEdit && c.suaDuoc && (
                        <button
                          type="button"
                          className="btn sm del"
                          onClick={() => void xoa(f.id, f.filename)}
                          title="Xoá tài liệu"
                          aria-label={`Xoá ${f.filename}`}
                        >
                          <Trash2 size={13} aria-hidden />
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
    </section>
  )
}
