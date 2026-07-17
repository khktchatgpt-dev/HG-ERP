'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'
import { uploadFile } from '@/lib/upload'
import { formatBytes, maxBytesFor } from '@/lib/file-limits'
import { DOC_TYPE_LABEL } from '@/modules/core/files/files.schema'
import { isProductImage, type ProductFile } from './product-files'

/**
 * Loại tài liệu hiện trong hồ sơ. Cố ý KHÔNG có 'image': ảnh SP quản lý ở ô ảnh
 * (ProductImagePanel) — tải lên, đặt đại diện, xoá đều ở đó. Để ảnh ở cả hai nơi
 * thì user không biết chỗ nào là chỗ đúng để đổi ảnh.
 */
const TABS = ['drawing', 'bom', 'assembly', 'cert', 'other'] as const
type TabType = (typeof TABS)[number]

/** Gợi ý + lọc định dạng cho từng loại — hiện trong menu chọn khi tải lên. */
const DOC_META: Record<TabType, { hint: string; accept?: string }> = {
  drawing: {
    hint: 'CAD, PDF bản vẽ chi tiết / bản vẽ lắp',
    accept: '.pdf,.dwg,.dxf,image/*',
  },
  bom: { hint: 'Excel BOM, bảng định mức vật tư gốc', accept: '.xlsx,.xls,.csv' },
  assembly: { hint: 'Hướng dẫn lắp ráp cho khách / xưởng', accept: '.pdf,image/*' },
  cert: { hint: 'FSC, BSCI, test report lý-hoá, tải trọng…', accept: '.pdf,image/*' },
  other: { hint: 'Tài liệu khác chưa phân loại' },
}

/** File cũ chưa phân loại (doc_type null) gom vào "Khác". */
const tabOf = (f: ProductFile): TabType => (f.doc_type as TabType) ?? 'other'

/**
 * Hồ sơ tài liệu SP — chia TAB theo loại (bản vẽ / BOM / lắp ráp / chứng chỉ /
 * khác) thay vì một danh sách dài gộp chung. Ảnh SP không nằm ở đây.
 * Dùng chung ở trang Chi tiết và trang Sửa.
 */
export function ProductFilesPanel({
  productId,
  canEdit,
}: {
  productId: string
  canEdit: boolean
}) {
  const toast = useToast()
  const confirm = useConfirm()
  const [files, setFiles] = useState<ProductFile[]>([])
  const [tab, setTab] = useState<TabType>('drawing')

  const reload = useCallback(async () => {
    try {
      const data = await api<{ files: ProductFile[] }>(
        `/api/files?product_id=${productId}`,
      )
      setFiles(data.files.filter((f) => !isProductImage(f)))
    } catch {
      /* im lặng — không chặn xem hồ sơ */
    }
  }, [productId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  async function download(f: ProductFile) {
    try {
      const { url } = await api<{ url: string }>(`/api/files/${f.id}`)
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error('Không tải được file', apiErrorText(e))
    }
  }

  async function remove(f: ProductFile) {
    const ok = await confirm({
      title: `Xoá file "${f.filename}"?`,
      description: 'File sẽ bị gỡ khỏi hồ sơ sản phẩm.',
      tone: 'danger',
      confirmLabel: 'Xoá',
    })
    if (!ok) return
    try {
      await api(`/api/files/${f.id}`, { method: 'DELETE' })
      toast.success('Đã xoá file', f.filename)
      void reload()
    } catch (e) {
      toast.error('Xoá thất bại', apiErrorText(e))
    }
  }

  const countOf = (t: TabType) => files.filter((f) => tabOf(f) === t).length
  const current = files.filter((f) => tabOf(f) === tab)

  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h2 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
          Hồ sơ tài liệu ({files.length})
        </h2>
        {canEdit && (
          <UploadMenu productId={productId} onUploaded={reload} onPicked={setTab} />
        )}
      </div>

      {/* Tabs — luôn hiện đủ loại kể cả khi trống, để biết hồ sơ còn thiếu gì. */}
      <div
        role="tablist"
        aria-label="Loại tài liệu"
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-2 pt-2 dark:border-zinc-800"
      >
        {TABS.map((t) => {
          const n = countOf(t)
          const selected = t === tab
          return (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setTab(t)}
              className={`shrink-0 rounded-t-md border-b-2 px-3 py-1.5 text-xs whitespace-nowrap transition ${
                selected
                  ? 'border-sky-500 font-medium text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {DOC_TYPE_LABEL[t]}{' '}
              <span className={n === 0 ? 'text-zinc-300 dark:text-zinc-600' : ''}>
                ({n})
              </span>
            </button>
          )
        })}
      </div>

      {current.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-zinc-400">
          Chưa có {DOC_TYPE_LABEL[tab].toLowerCase()}.
          {canEdit && ' Bấm “+ Tải lên” rồi chọn loại này.'}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 px-4 dark:divide-zinc-900">
          {current.map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2 text-sm">
              <button
                onClick={() => void download(f)}
                className="min-w-0 flex-1 truncate text-left text-sky-600 hover:underline dark:text-sky-400"
                title={f.filename}
              >
                {f.filename}
              </button>
              <span className="shrink-0 text-xs text-zinc-400">
                {formatBytes(f.size_bytes)} ·{' '}
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
    </section>
  )
}

/**
 * 1 nút "+ Tải lên" → menu chọn loại → mở luôn hộp thoại chọn file với `accept`
 * đúng loại đó. Loại được ghim qua ref (không qua state) để `accept` đã đúng
 * TRƯỚC khi hộp thoại mở.
 */
function UploadMenu({
  productId,
  onUploaded,
  onPicked,
}: {
  productId: string
  onUploaded: () => void
  /** Nhảy sang tab vừa tải lên, để user thấy ngay file mình vừa thêm. */
  onPicked: (t: TabType) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<TabType | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function pick(t: TabType) {
    setOpen(false)
    pendingRef.current = t
    const el = inputRef.current
    if (!el) return
    el.accept = DOC_META[t].accept ?? ''
    el.value = ''
    el.click()
  }

  async function onFile(file: File) {
    const t = pendingRef.current
    if (!t) return
    const max = maxBytesFor(t)
    if (file.size > max) {
      toast.error('Tệp quá lớn', `${formatBytes(file.size)} — tối đa ${formatBytes(max)}`)
      return
    }
    setBusy(true)
    try {
      await uploadFile(file, { kind: 'product', id: productId }, 'attachments', t)
      toast.success(`Đã tải lên — ${DOC_TYPE_LABEL[t]}`, file.name)
      onPicked(t)
      onUploaded()
    } catch (e) {
      toast.error('Tải lên thất bại', apiErrorText(e))
    } finally {
      setBusy(false)
      pendingRef.current = null
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          if (f) void onFile(f)
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {busy && <Spinner size={12} />}
        {busy ? 'Đang tải…' : '+ Tải lên'}
        {!busy && <span className="text-xs text-zinc-400">▾</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {TABS.map((t) => (
              <button
                key={t}
                role="menuitem"
                type="button"
                onClick={() => pick(t)}
                className="block w-full px-3 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="text-sm">{DOC_TYPE_LABEL[t]}</div>
                <div className="text-[11px] text-zinc-400">{DOC_META[t].hint}</div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
