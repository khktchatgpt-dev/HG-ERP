'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  Eye,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shadcn/dropdown-menu'
import { uploadFileTracked } from '@/lib/upload'
import { DOC_TYPE_LABEL, formatBytes, maxBytesFor } from '@/lib/file-limits'
import { cn } from '@/lib/utils'
import { isProductImage, type ProductFile } from './product-files'
import { FilePreviewDialog } from './FilePreviewDialog'
import { UploadQueue, type QueueItem } from './UploadQueue'

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

/**
 * Đoán loại tài liệu cho file vừa THẢ vào.
 *
 * Quy tắc: đuôi nào chỉ thuộc đúng một ngăn thì theo đuôi; còn lại (PDF, ảnh —
 * vừa là bản vẽ, vừa là hướng dẫn, vừa là chứng chỉ) thì theo TAB ĐANG MỞ. Nghĩa
 * là "thả vào ngăn nào thì nằm ngăn đó", trừ khi đuôi file nói ngược lại rõ
 * ràng. Đoán sai vẫn sửa được ngay trong hàng đợi trước khi lưu.
 */
function guessDocType(filename: string, currentTab: TabType): TabType {
  const e = ext(filename)
  if (SHEET.has(e)) return 'bom'
  if (SLIDE.has(e)) return 'packing'
  if (e === 'dwg' || e === 'dxf') return 'drawing'
  return currentTab
}

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
 * XEM TRƯỚC TRONG TRANG (15/08/2026): bật lại phần rẻ và chắc — ảnh + PDF nhúng
 * bằng thẻ có sẵn của trình duyệt (`FilePreviewDialog`). Bản đọc .xlsx bằng
 * SheetJS từng dựng rồi bỏ 13/08 thì vẫn để đó; 540 file BOM tên na ná nhau là
 * lý do đủ để ít nhất không bắt người dùng tải về mới biết mở đúng file chưa.
 *
 * TẢI LÊN: kéo-thả nhiều file vào cả panel, có hàng đợi + % thật
 * (`UploadQueue`). Nút "Tải lên" vẫn giữ cho ai quen bấm.
 *
 * Phần "chốt bản BOM đang dùng" (0140) đã bỏ theo yêu cầu 13/08: nhãn ĐANG DÙNG
 * / bản cũ / nút "Dùng bản này" không còn. Cột `bom_file_id` vẫn nằm trong DB,
 * dữ liệu cũ không mất.
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
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ProductFile | null>(null)
  /** Đếm dragenter/dragleave: kéo qua phần tử con cũng bắn dragleave. */
  const dragDepth = useRef(0)
  const seq = useRef(0)

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

  /** Nhận file từ kéo-thả HOẶC từ hộp thoại chọn file → đẩy vào hàng đợi. */
  const enqueue = useCallback(
    (list: FileList | File[], forced?: TabType) => {
      const added: QueueItem[] = [...list].map((file) => ({
        key: `q${++seq.current}`,
        file,
        docType: forced ?? guessDocType(file.name, tab),
        status: 'cho' as const,
        percent: 0,
      }))
      if (added.length > 0) setQueue((q) => [...q, ...added])
    },
    [tab],
  )

  /**
   * Tải TUẦN TỰ từng file. Cố ý không chạy song song: đường truyền công ty có
   * hạn, 10 file cùng lúc thì file nào cũng bò và thanh % nào cũng đứng.
   * Một file lỗi KHÔNG dừng mẻ — nó ở lại hàng đợi với lý do riêng.
   */
  async function startUpload() {
    setUploading(true)
    const pending = queue.filter((i) => i.status === 'cho')
    let ok = 0
    for (const item of pending) {
      const patch = (p: Partial<QueueItem>) =>
        setQueue((q) => q.map((x) => (x.key === item.key ? { ...x, ...p } : x)))
      patch({ status: 'dang-tai', percent: 0, error: undefined })
      try {
        await uploadFileTracked(
          item.file,
          { kind: 'product', id: productId },
          'attachments',
          item.docType,
          (percent) => patch({ percent }),
        )
        patch({ status: 'xong', percent: 100 })
        ok += 1
      } catch (e) {
        patch({ status: 'loi', error: apiErrorText(e) })
      }
    }
    setUploading(false)
    if (ok > 0) {
      toast.success(`Đã tải lên ${ok} file`)
      // Nhảy sang ngăn của file đầu tiên lưu được, để thấy ngay thứ vừa thêm.
      // `QueueItem.docType` là DocType đầy đủ (có cả 'image' — ngăn không hiện ở
      // panel này), nên phải lọc về TabType thay vì ép kiểu.
      const landed = pending
        .map((p) => p.docType)
        .find((t): t is TabType => (TABS as readonly string[]).includes(t))
      if (landed) setTab(landed)
      await reload()
      // Dọn các dòng đã xong, giữ lại dòng lỗi để người dùng còn thấy lý do.
      setQueue((q) => q.filter((i) => i.status === 'loi'))
    }
  }

  const countOf = (t: TabType) => files.filter((f) => tabOf(f) === t).length
  const current = files.filter((f) => tabOf(f) === tab)

  return (
    <section
      className={cn(
        'bg-card relative overflow-hidden rounded-xl border transition-colors',
        dragOver && 'border-primary bg-primary/5',
      )}
      onDragEnter={(e) => {
        if (!canEdit || !e.dataTransfer.types.includes('Files')) return
        dragDepth.current += 1
        setDragOver(true)
      }}
      onDragOver={(e) => {
        if (canEdit && e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current -= 1
        if (dragDepth.current <= 0) {
          dragDepth.current = 0
          setDragOver(false)
        }
      }}
      onDrop={(e) => {
        if (!canEdit) return
        e.preventDefault()
        dragDepth.current = 0
        setDragOver(false)
        if (e.dataTransfer.files.length > 0) enqueue(e.dataTransfer.files)
      }}
    >
      {dragOver && (
        <div className="border-primary bg-primary/10 text-primary pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border-2 border-dashed text-sm font-medium">
          Thả file vào đây — vào ngăn “{DOC_TYPE_LABEL[tab]}” trừ khi đuôi file nói khác
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="text-muted-foreground size-4" aria-hidden />
          Hồ sơ tài liệu
          <span className="text-muted-foreground font-normal">({files.length})</span>
        </h2>
        {canEdit && <UploadMenu onPick={enqueue} busy={uploading} />}
      </div>

      {canEdit && (
        <UploadQueue
          items={queue}
          docTypes={TABS}
          busy={uploading}
          onChangeType={(key, t) =>
            setQueue((q) =>
              q.map((x) => (x.key === key ? { ...x, docType: t as TabType } : x)),
            )
          }
          onRemove={(key) => setQueue((q) => q.filter((x) => x.key !== key))}
          onStart={() => void startUpload()}
          onClear={() => setQueue([])}
        />
      )}

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
            {canEdit && ' Kéo file thả vào đây, hoặc bấm “Tải lên”.'}
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
                onClick={() => setPreview(f)}
                className="min-w-0 flex-1 text-start"
                title={`Xem trước ${f.filename}`}
              >
                <span className="block truncate text-sm hover:underline">
                  {f.filename}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {/* Ai tải lên đứng TRƯỚC dung lượng: 6 tháng sau, câu hỏi đầu
                      tiên về một file lạ luôn là "của ai", không phải "nặng bao nhiêu". */}
                  {f.owner_name ?? 'không rõ người tải'} ·{' '}
                  {new Date(f.created_at).toLocaleDateString('vi-VN')} ·{' '}
                  {formatBytes(f.size_bytes)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPreview(f)}
                aria-label="Xem trước"
                title="Xem trước"
                className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
              >
                <Eye className="size-4" aria-hidden />
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
          {formatBytes(maxBytesFor(tab))} · kéo-thả được nhiều file cùng lúc
        </p>
      )}

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </section>
  )
}

/**
 * 1 nút "Tải lên" → menu chọn loại → mở hộp thoại chọn file (CHỌN NHIỀU được)
 * với `accept` đúng loại đó, rồi đẩy thẳng vào hàng đợi.
 *
 * Nút này không còn tự upload nữa — mọi file đều đi qua hàng đợi chung với
 * đường kéo-thả, để chỉ có MỘT chỗ hiện tiến trình và MỘT chỗ báo lỗi.
 *
 * Menu dùng Radix (shadcn) chứ không phải div `absolute` tự viết: bản cũ nằm
 * TRONG `<section overflow-hidden>` nên bị xén mất mấy dòng cuối, và không tự
 * lật lên khi panel sát đáy màn hình. Radix render qua portal + tránh va mép.
 * Nhớ `theme-v2` trên content — portal nhảy ra ngoài shell nên mất token màu.
 */
function UploadMenu({
  onPick,
  busy,
}: {
  onPick: (files: FileList, forced: TabType) => void
  busy: boolean
}) {
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

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const t = pendingRef.current
          const list = e.currentTarget.files
          if (t && list && list.length > 0) onPick(list, t)
          pendingRef.current = null
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          className="bg-card inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden />
          Tải lên
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
