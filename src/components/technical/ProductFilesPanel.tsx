'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Presentation,
  Trash2,
} from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Spinner } from '@/components/erp/Spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { uploadFile } from '@/lib/upload'
import {
  DOC_TYPE_LABEL,
  formatBytes,
  isAllowedMime,
  maxBytesFor,
} from '@/lib/file-limits'
import { cn } from '@/lib/utils'
import { isProductImage, type ProductFile } from './product-files'

/**
 * Loại tài liệu hiện trong hồ sơ. Cố ý KHÔNG có 'image': ảnh SP quản lý ở ô ảnh
 * (ProductImagePanel) — tải lên, đặt đại diện, xoá đều ở đó. Để ảnh ở cả hai nơi
 * thì user không biết chỗ nào là chỗ đúng để đổi ảnh.
 */
const TABS = ['drawing', 'bom', 'packing', 'assembly', 'cert', 'other'] as const
type TabType = (typeof TABS)[number]

/**
 * Gợi ý + định dạng nhận + bộ lọc hộp thoại chọn file cho từng loại.
 * `formats` là chữ cho NGƯỜI đọc (hiện trong menu), `accept` là chữ cho TRÌNH
 * DUYỆT lọc — hai thứ phải nói cùng một điều, nên khai cạnh nhau.
 */
const DOC_META: Record<TabType, { hint: string; formats: string; accept?: string }> = {
  drawing: {
    hint: 'CAD, PDF bản vẽ chi tiết / bản vẽ lắp',
    formats: 'PDF, DWG, DXF, ảnh',
    accept: '.pdf,.dwg,.dxf,image/*',
  },
  bom: {
    hint: 'Excel BOM, bảng định mức vật tư gốc',
    formats: 'Excel, CSV',
    accept: '.xlsx,.xls,.csv',
  },
  // 0150 — Kỹ thuật giữ quy cách đóng gói dạng PowerPoint (mỗi slide một SP).
  packing: {
    hint: 'Quy cách đóng gói, kích thước thùng / SP',
    formats: 'PowerPoint, PDF, ảnh',
    accept: '.pptx,.ppt,.pdf,image/*',
  },
  assembly: {
    hint: 'Hướng dẫn lắp ráp cho khách / xưởng',
    formats: 'PDF, ảnh',
    accept: '.pdf,image/*',
  },
  cert: {
    hint: 'FSC, BSCI, test report lý-hoá, tải trọng…',
    formats: 'PDF, ảnh',
    accept: '.pdf,image/*',
  },
  other: {
    hint: 'Tài liệu khác chưa phân loại',
    formats: 'PDF, Office, ảnh, ZIP',
  },
}

/** File cũ chưa phân loại (doc_type null) gom vào "Khác". */
const tabOf = (f: ProductFile): TabType => (f.doc_type as TabType) ?? 'other'

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''
const IMG = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg'])
const SHEET = new Set(['xlsx', 'xls', 'csv'])
const SLIDE = new Set(['pptx', 'ppt'])

/** Icon theo đuôi file — nhận dạng nhanh hơn đọc tên file dài. */
function FileIcon({ f, className }: { f: ProductFile; className?: string }) {
  const e = ext(f.filename)
  const Icon = IMG.has(e)
    ? ImageIcon
    : SHEET.has(e)
      ? FileSpreadsheet
      : SLIDE.has(e)
        ? Presentation
        : FileText
  return <Icon className={className} aria-hidden />
}

/**
 * HỒ SƠ TÀI LIỆU SP — chia TAB theo loại (bản vẽ / BOM / lắp ráp / chứng chỉ /
 * khác). Ảnh SP không nằm ở đây.
 *
 * XEM TRỰC TIẾP TRONG TRANG: đã dựng (ảnh + PDF nhúng, Excel đọc bằng SheetJS)
 * rồi user cho TẠM BỎ 13/08/2026. Nên tab này quay về đúng một việc: giữ tài
 * liệu, tải về, xoá. Muốn bật lại thì dựng lại khung xem bên phải — phần khó
 * (URL ký, đọc .xlsx phía client) đã làm được, không có rào kỹ thuật nào.
 *
 * Phần "chốt bản BOM đang dùng" (0140) cũng đã bỏ theo yêu cầu cùng ngày: nhãn
 * ĐANG DÙNG / bản cũ / nút "Dùng bản này" không còn. Cột `bom_file_id` vẫn nằm
 * trong DB, dữ liệu cũ không mất.
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
      const r = await api<{ url: string }>(`/api/files/${f.id}`)
      window.open(r.url, '_blank', 'noopener')
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
    <section className="bg-card overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="text-muted-foreground size-4" aria-hidden />
          Hồ sơ tài liệu
          <span className="text-muted-foreground font-normal">({files.length})</span>
        </h2>
        {canEdit && (
          <UploadMenu productId={productId} onUploaded={reload} onPicked={setTab} />
        )}
      </div>

      {/* Tabs — luôn hiện đủ loại kể cả khi trống, để biết hồ sơ còn thiếu gì. */}
      <div
        role="tablist"
        aria-label="Loại tài liệu"
        className="flex gap-1 overflow-x-auto border-b px-2 pt-2"
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
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                selected
                  ? 'border-primary text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground border-transparent',
              )}
            >
              {DOC_TYPE_LABEL[t]}
              <span
                className={cn(
                  'ms-1.5 text-xs tabular-nums',
                  n === 0 && 'text-muted-foreground/60',
                )}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      {current.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Chưa có {DOC_TYPE_LABEL[tab].toLowerCase()}.
            {canEdit && ' Bấm “Tải lên” rồi chọn loại này.'}
          </p>
          {canEdit && (
            <p className="text-muted-foreground/80 mt-1 text-xs">
              Nhận {DOC_META[tab].formats} · tối đa {formatBytes(maxBytesFor(tab))}
            </p>
          )}
        </div>
      ) : (
        <ul className="divide-y">
          {current.map((f) => (
            <li
              key={f.id}
              className="hover:bg-accent/40 flex items-center gap-3 px-4 py-2.5"
            >
              <FileIcon f={f} className="text-muted-foreground size-4 shrink-0" />
              <button
                type="button"
                onClick={() => void download(f)}
                className="min-w-0 flex-1 text-start"
                title={`Tải về ${f.filename}`}
              >
                <span className="block truncate text-sm hover:underline">
                  {f.filename}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {formatBytes(f.size_bytes)} ·{' '}
                  {new Date(f.created_at).toLocaleDateString('vi-VN')}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void download(f)}
                aria-label="Tải về"
                title="Tải về"
                className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
              >
                <Download className="size-4" aria-hidden />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void remove(f)}
                  aria-label="Xoá file"
                  title="Xoá file"
                  className="text-muted-foreground shrink-0 rounded p-1 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Hạn mức nói NGAY trên panel, không đợi user mở menu mới biết — trước
          đây chỉ hiện lúc bị chặn ("Tệp quá lớn"), tức là sau khi đã mất công. */}
      {canEdit && current.length > 0 && (
        <p className="text-muted-foreground/80 border-t px-4 py-2 text-xs">
          {DOC_TYPE_LABEL[tab]}: nhận {DOC_META[tab].formats} · tối đa{' '}
          {formatBytes(maxBytesFor(tab))}
        </p>
      )}
    </section>
  )
}

/**
 * 1 nút "Tải lên" → menu chọn loại → mở luôn hộp thoại chọn file với `accept`
 * đúng loại đó. Loại được ghim qua ref (không qua state) để `accept` đã đúng
 * TRƯỚC khi hộp thoại mở.
 *
 * Menu dùng Radix (shadcn) chứ không phải div `absolute` tự viết: bản cũ nằm
 * TRONG `<section overflow-hidden>` nên bị xén mất mấy dòng cuối, và không tự
 * lật lên khi panel sát đáy màn hình. Radix render qua portal + tránh va mép.
 * Nhớ `theme-v2` trên content — portal nhảy ra ngoài shell nên mất token màu.
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
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<TabType | null>(null)

  function pick(t: TabType) {
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
    // Máy không cài Office có thể trả MIME rỗng cho .pptx/.xlsx — báo trước một
    // câu đọc được, thay vì để server dội lỗi enum khó hiểu.
    if (!isAllowedMime(file.type)) {
      toast.error(
        'Định dạng không nhận',
        `${file.name} — hệ thống nhận PDF, ảnh, Word, Excel, PowerPoint, CSV, ZIP.`,
      )
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
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0]
          if (f) void onFile(f)
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          className="bg-card inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Spinner size={12} /> : <Plus className="size-4" aria-hidden />}
          {busy ? 'Đang tải…' : 'Tải lên'}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="theme-v2 w-72">
          {TABS.map((t) => (
            <DropdownMenuItem
              key={t}
              onSelect={() => pick(t)}
              className="flex-col items-start gap-0.5"
            >
              <span className="text-sm font-medium">{DOC_TYPE_LABEL[t]}</span>
              <span className="text-muted-foreground text-[11px]">
                {DOC_META[t].hint}
              </span>
              <span className="text-muted-foreground/80 text-[11px]">
                {DOC_META[t].formats} · tối đa {formatBytes(maxBytesFor(t))}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
