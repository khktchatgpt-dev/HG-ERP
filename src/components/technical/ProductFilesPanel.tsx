'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Film,
  Image as ImageIcon,
  Paperclip,
  PencilLine,
  Plus,
  Presentation,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Modal } from '@/components/Modal'
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
 * Loại tài liệu hiện trong hồ sơ, THEO THỨ TỰ bày ra màn.
 *
 * Cố ý KHÔNG có 'image': ảnh SP quản lý ở ô ảnh (ProductImagePanel) — tải lên,
 * đặt đại diện, xoá đều ở đó. Để ảnh ở cả hai nơi thì user không biết chỗ nào là
 * chỗ đúng để đổi ảnh. `sample_photo` (ảnh mẫu ĐÃ DUYỆT) thì khác và nằm ở đây.
 */
const KINDS = [
  'drawing',
  'bom',
  'packing',
  'assembly',
  'sample_photo',
  'label',
  'loading',
  'cert',
  'approval',
  'video',
  'other',
] as const
type Kind = (typeof KINDS)[number]

/**
 * Gợi ý + định dạng nhận + bộ lọc hộp thoại chọn file cho từng loại.
 * `formats` là chữ cho NGƯỜI đọc (hiện trong menu), `accept` là chữ cho TRÌNH
 * DUYỆT lọc — hai thứ phải nói cùng một điều, nên khai cạnh nhau.
 */
const DOC_META: Record<Kind, { hint: string; formats: string; accept?: string }> = {
  drawing: {
    hint: 'Bản vẽ chi tiết / bản vẽ lắp, file CAD gốc',
    formats: 'DWG, DXF, STEP, IGS, SKP, PDF, ảnh',
    accept: '.dwg,.dxf,.step,.stp,.igs,.iges,.skp,.pdf,image/*',
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
  sample_photo: {
    hint: 'Ảnh mẫu thật đã chốt với khách — khác ảnh đại diện SP',
    formats: 'Ảnh',
    accept: 'image/*',
  },
  label: {
    hint: 'Nhãn, mã vạch, shipping mark — file artwork gốc',
    formats: 'AI, PSD, PDF, ảnh',
    accept: '.ai,.psd,.pdf,image/*',
  },
  loading: {
    hint: 'Sơ đồ xếp cont, phương án xếp hàng',
    formats: 'PDF, PowerPoint, Excel, ảnh',
    accept: '.pdf,.pptx,.ppt,.xlsx,image/*',
  },
  cert: {
    hint: 'FSC, BSCI, test report lý-hoá, tải trọng…',
    formats: 'PDF, ảnh',
    accept: '.pdf,image/*',
  },
  approval: {
    hint: 'Email / PO khách xác nhận mẫu, biên bản duyệt',
    formats: 'PDF, Word, ảnh',
    accept: '.pdf,.doc,.docx,image/*',
  },
  video: {
    hint: 'Clip quay mẫu, hướng dẫn lắp',
    formats: 'MP4',
    accept: '.mp4',
  },
  other: {
    hint: 'Tài liệu khác chưa phân loại',
    formats: 'PDF, Office, ảnh, ZIP',
  },
}

/** File cũ chưa phân loại (doc_type null) gom vào "Khác". */
const kindOf = (f: ProductFile): Kind => (f.doc_type as Kind) ?? 'other'

const ext = (name: string) => name.split('.').pop()?.toLowerCase() ?? ''
const IMG = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'])
const SHEET = new Set(['xlsx', 'xls', 'csv'])
const SLIDE = new Set(['pptx', 'ppt'])
const CAD = new Set(['dwg', 'dxf', 'step', 'stp', 'igs', 'iges', 'skp'])
const ARTWORK = new Set(['ai', 'psd'])
const VIDEO = new Set(['mp4'])

/**
 * Đoán loại tài liệu cho file vừa THẢ vào — chỉ theo ĐUÔI.
 *
 * Trước 31/08/2026 hàm này còn nhận "tab đang mở" làm mặc định, vì màn này chia
 * 6 tab. Bỏ tab rồi thì không còn ngữ cảnh đó: đuôi nào chỉ thuộc đúng một ngăn
 * thì theo đuôi, còn PDF/ảnh (vừa là bản vẽ, vừa là hướng dẫn, vừa là chứng chỉ)
 * rơi vào "Khác" và người dùng sửa ngay trong hàng đợi trước khi lưu — chỗ đó
 * hiện rõ ràng, chọn một lần cho cả mẻ.
 */
function guessKind(filename: string): Kind {
  const e = ext(filename)
  if (SHEET.has(e)) return 'bom'
  if (SLIDE.has(e)) return 'packing'
  if (CAD.has(e)) return 'drawing'
  if (ARTWORK.has(e)) return 'label'
  if (VIDEO.has(e)) return 'video'
  return 'other'
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
        : VIDEO.has(e)
          ? Film
          : FileText
  return <Icon className={className} aria-hidden />
}

/**
 * HỒ SƠ TÀI LIỆU SP — MỘT danh sách, nhóm theo loại. Ảnh đại diện không ở đây.
 *
 * VÌ SAO BỎ TAB (31/08/2026): đo thật thì trung vị là 2 file/SP (1 ảnh + 1 BOM),
 * mà màn này chia 6 tab — mở ngăn nào cũng trống, và phải bấm hết sáu ngăn mới
 * biết hồ sơ có gì. Tab là cách bày cho danh sách DÀI. Giờ nhóm nào rỗng thì
 * KHÔNG vẽ, chỉ nêu tên ở dòng "Chưa có" cuối màn — dòng đó vừa nói hồ sơ còn
 * thiếu gì, vừa là chỗ bấm để tải đúng loại đó lên.
 *
 * XEM TRƯỚC TRONG TRANG (15/08/2026): ảnh + PDF nhúng bằng thẻ có sẵn của trình
 * duyệt (`FilePreviewDialog`). Bản đọc .xlsx bằng SheetJS từng dựng rồi bỏ
 * 13/08; 540 file BOM tên na ná nhau là lý do đủ để ít nhất không bắt người dùng
 * tải về mới biết mở đúng file chưa.
 *
 * TẢI LÊN: kéo-thả nhiều file vào cả panel, có hàng đợi + % thật
 * (`UploadQueue`). Nút "Thêm tài liệu" vẫn giữ cho ai quen bấm.
 *
 * BẢN ĐANG DÙNG (0181) — nút sao trên mỗi dòng, áp cho MỌI loại chứ không riêng
 * BOM. Bản đầu (0140) làm bằng `technical_products.bom_file_id`, tức một cột cho
 * một loại; bỏ 13/08 vì lúc đó chỉ có BOM dùng tới. Nay cờ nằm trên chính file
 * nên thêm loại không tốn cột nào, và DB ép "mỗi (SP, loại) đúng một bản" bằng
 * UNIQUE index. `bom_file_id` vẫn nằm trong DB (ảnh chụp phiên bản 0143 tham
 * chiếu nó) và đã được 0181 chuyển sang cờ mới.
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
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<ProductFile | null>(null)
  /** File đang mở hộp sửa ghi chú / phiên bản (0181). */
  const [editing, setEditing] = useState<ProductFile | null>(null)
  /** Đếm dragenter/dragleave: kéo qua phần tử con cũng bắn dragleave. */
  const dragDepth = useRef(0)
  const seq = useRef(0)
  /** Hộp thoại chọn file dùng chung cho nút "Thêm" và các chip "Chưa có". */
  const pickRef = useRef<((k: Kind) => void) | null>(null)

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
      const r = await api<{ url: string }>(`/api/files/${f.id}?download=1`)
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
  const enqueue = useCallback((list: FileList | File[], forced?: Kind) => {
    const added: QueueItem[] = [...list].map((file) => ({
      key: `q${++seq.current}`,
      file,
      docType: forced ?? guessKind(file.name),
      status: 'cho' as const,
      percent: 0,
    }))
    if (added.length > 0) setQueue((q) => [...q, ...added])
  }, [])

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
      await reload()
      // Dọn các dòng đã xong, giữ lại dòng lỗi để người dùng còn thấy lý do.
      setQueue((q) => q.filter((i) => i.status === 'loi'))
    }
  }

  /** Đánh dấu / bỏ đánh dấu BẢN ĐANG DÙNG (0181). */
  async function toggleCurrent(f: ProductFile) {
    try {
      await api(`/api/files/${f.id}`, {
        method: 'PATCH',
        body: { is_current: !f.is_current },
      })
      void reload()
    } catch (e) {
      toast.error('Không đổi được bản đang dùng', apiErrorText(e))
    }
  }

  async function saveMeta(id: string, rev: string, note: string) {
    await api(`/api/files/${id}`, { method: 'PATCH', body: { rev, note } })
    setEditing(null)
    toast.success('Đã lưu ghi chú')
    void reload()
  }

  // Nhóm rỗng KHÔNG vẽ — chúng đi vào dòng "Chưa có" ở cuối. Bản ĐANG DÙNG lên
  // đầu nhóm: đó là file người ta mở 9/10 lần, để nó lẫn giữa các bản cũ theo
  // ngày thì cái nhãn chẳng tiết kiệm được cú nhìn nào.
  const groups = KINDS.map((k) => ({
    kind: k,
    items: files
      .filter((f) => kindOf(f) === k)
      .sort((a, b) => Number(b.is_current) - Number(a.is_current)),
  }))
  const filled = groups.filter((g) => g.items.length > 0)
  const missing = groups.filter((g) => g.items.length === 0).map((g) => g.kind)

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
          Thả file vào đây — hệ thống tự nhận loại theo đuôi file
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="text-muted-foreground size-4" aria-hidden />
          Hồ sơ tài liệu
          <span className="text-muted-foreground font-normal">({files.length})</span>
        </h2>
        {canEdit && (
          <UploadMenu
            onPick={enqueue}
            busy={uploading}
            registerPick={(fn) => {
              pickRef.current = fn
            }}
          />
        )}
      </div>

      {canEdit && (
        <UploadQueue
          items={queue}
          docTypes={KINDS}
          busy={uploading}
          onChangeType={(key, t) =>
            setQueue((q) =>
              q.map((x) => (x.key === key ? { ...x, docType: t as Kind } : x)),
            )
          }
          onRemove={(key) => setQueue((q) => q.filter((x) => x.key !== key))}
          onStart={() => void startUpload()}
          onClear={() => setQueue([])}
        />
      )}

      {/* Khu thả file NHÌN THẤY ĐƯỢC. Trước đây cả panel nhận kéo-thả nhưng
          không có gì nói ra điều đó, nên ai không đọc dòng chữ nhỏ cuối màn thì
          không biết là kéo được. */}
      {canEdit && queue.length === 0 && (
        <button
          type="button"
          onClick={() => pickRef.current?.('other')}
          className="text-muted-foreground hover:border-primary hover:text-primary m-3 flex w-[calc(100%-1.5rem)] items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-xs transition-colors"
        >
          <UploadCloud className="size-4" aria-hidden />
          Kéo thả file vào đây, hoặc bấm để chọn — tự nhận loại theo đuôi file
        </button>
      )}

      {files.length === 0 ? (
        <p className="text-muted-foreground px-4 pb-6 text-center text-sm">
          Hồ sơ này chưa có tài liệu nào.
        </p>
      ) : (
        <div className="divide-y">
          {filled.map((g) => (
            <div key={g.kind}>
              <div className="bg-muted/40 flex items-center gap-2 px-4 py-1.5">
                <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  {DOC_TYPE_LABEL[g.kind]}
                </h3>
                <span className="text-muted-foreground/60 text-xs tabular-nums">
                  {g.items.length}
                </span>
              </div>
              <ul className="divide-y">
                {g.items.map((f) => (
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
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm hover:underline">
                          {f.filename}
                        </span>
                        {f.rev && (
                          <span className="text-muted-foreground shrink-0 rounded border px-1 font-mono text-[10px]">
                            {f.rev}
                          </span>
                        )}
                        {f.is_current && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                            ĐANG DÙNG
                          </span>
                        )}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {/* Ai tải lên đứng TRƯỚC dung lượng: 6 tháng sau, câu hỏi
                            đầu tiên về một file lạ luôn là "của ai", không phải
                            "nặng bao nhiêu". */}
                        {f.owner_name ?? 'không rõ người tải'} ·{' '}
                        {new Date(f.created_at).toLocaleDateString('vi-VN')} ·{' '}
                        {formatBytes(f.size_bytes)}
                      </span>
                      {f.note && (
                        <span className="text-muted-foreground/90 mt-0.5 block text-xs italic">
                          {f.note}
                        </span>
                      )}
                    </button>
                    {canEdit && (
                      <>
                        {/* Sao đặc = bản đang dùng. Hiện thường trực chứ không
                            chỉ khi hover: máy cảm ứng không có hover. */}
                        <button
                          type="button"
                          onClick={() => void toggleCurrent(f)}
                          aria-pressed={f.is_current}
                          aria-label={
                            f.is_current ? 'Bỏ đánh dấu bản đang dùng' : 'Dùng bản này'
                          }
                          title={
                            f.is_current
                              ? 'Đang là bản dùng — bấm để bỏ đánh dấu'
                              : 'Đánh dấu là bản đang dùng của loại này'
                          }
                          className={cn(
                            'shrink-0 rounded p-1',
                            f.is_current
                              ? 'text-amber-500'
                              : 'text-muted-foreground/50 hover:text-amber-500',
                          )}
                        >
                          <Star
                            className="size-4"
                            fill={f.is_current ? 'currentColor' : 'none'}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(f)}
                          aria-label="Ghi chú / phiên bản"
                          title="Ghi chú / phiên bản"
                          className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1"
                        >
                          <PencilLine className="size-4" aria-hidden />
                        </button>
                      </>
                    )}
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
            </div>
          ))}
        </div>
      )}

      {/* DÒNG "CHƯA CÓ" — thay cho mấy tab rỗng ngày trước. Nó trả lời đúng câu
          người mở hồ sơ muốn hỏi ("còn thiếu gì?") trong một dòng, và mỗi tên là
          một nút tải đúng loại đó lên. */}
      {missing.length > 0 && (
        <div className="text-muted-foreground/80 flex flex-wrap items-center gap-x-1.5 gap-y-1 border-t px-4 py-2.5 text-xs">
          <span>Chưa có:</span>
          {missing.map((k) =>
            canEdit ? (
              <button
                key={k}
                type="button"
                onClick={() => pickRef.current?.(k)}
                title={`Tải lên ${DOC_TYPE_LABEL[k].toLowerCase()} — ${DOC_META[k].formats}`}
                className="hover:border-primary hover:text-primary rounded-full border border-dashed px-2 py-0.5 transition-colors"
              >
                {DOC_TYPE_LABEL[k]}
              </button>
            ) : (
              <span key={k} className="rounded-full border border-dashed px-2 py-0.5">
                {DOC_TYPE_LABEL[k]}
              </span>
            ),
          )}
        </div>
      )}

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
      <MetaDialog
        file={editing}
        onClose={() => setEditing(null)}
        onSave={saveMeta}
        onError={(m) => toast.error('Không lưu được', m)}
      />
    </section>
  )
}

/**
 * Hộp sửa GHI CHÚ + KÝ HIỆU PHIÊN BẢN của một file.
 *
 * `rev` để gõ tự do ("Rev 3", "v2.1", "bản 12/8") chứ không ép số: xưởng gọi
 * phiên bản mỗi người một kiểu, ép số là họ bịa ra một con số rồi ghi cách gọi
 * thật vào ghi chú — hai ô nói cùng một chuyện. Xem 0181.
 */
function MetaDialog({
  file,
  onClose,
  onSave,
  onError,
}: {
  file: ProductFile | null
  onClose: () => void
  onSave: (id: string, rev: string, note: string) => Promise<void>
  onError: (message: string) => void
}) {
  const [rev, setRev] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  // Nạp lại mỗi lần mở file khác. `key` ở ngoài cũng làm được, nhưng hộp này
  // render cả khi `file` null (Modal tự ẩn) nên effect gọn hơn.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync theo file đang mở
    setRev(file?.rev ?? '')

    setNote(file?.note ?? '')
  }, [file])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || busy) return
    setBusy(true)
    try {
      await onSave(file.id, rev, note)
    } catch (e) {
      onError(apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={!!file} onClose={onClose} title="Ghi chú / phiên bản">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <p className="text-muted-foreground truncate text-xs">{file?.filename}</p>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="t-label">Ký hiệu phiên bản</span>
          <input
            value={rev}
            onChange={(e) => setRev(e.target.value)}
            maxLength={50}
            placeholder="Rev 3, v2.1, bản 12/8…"
            className="bg-background focus-visible:ring-ring/50 h-9 rounded-md border px-3 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="t-label">Ghi chú</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="VD: bản sửa theo mail khách 12/8, đã bỏ tay vịn"
            className="bg-background focus-visible:ring-ring/50 rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="bg-card rounded-md border px-3 py-1.5 text-sm"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Nút "Thêm tài liệu" → menu chọn loại → mở hộp thoại chọn file (CHỌN NHIỀU
 * được) với `accept` đúng loại đó, rồi đẩy thẳng vào hàng đợi.
 *
 * Nút này không tự upload — mọi file đều đi qua hàng đợi chung với đường
 * kéo-thả, để chỉ có MỘT chỗ hiện tiến trình và MỘT chỗ báo lỗi.
 *
 * `registerPick` đưa hàm mở hộp thoại ra ngoài, cho khu thả file và các chip
 * "Chưa có" dùng lại đúng một `<input type=file>` — dựng thêm input thứ hai là
 * thêm một chỗ nữa phải nhớ đồng bộ `accept`.
 *
 * Menu dùng Radix (shadcn) chứ không phải div `absolute` tự viết: bản cũ nằm
 * TRONG `<section overflow-hidden>` nên bị xén mất mấy dòng cuối, và không tự
 * lật lên khi panel sát đáy màn hình. Radix render qua portal + tránh va mép.
 * Nhớ `theme-v3` trên content — portal nhảy ra ngoài shell nên mất token màu.
 */
function UploadMenu({
  onPick,
  busy,
  registerPick,
}: {
  onPick: (files: FileList, forced: Kind) => void
  busy: boolean
  registerPick: (fn: (k: Kind) => void) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const pendingRef = useRef<Kind | null>(null)

  const pick = useCallback((t: Kind) => {
    pendingRef.current = t
    const el = inputRef.current
    if (!el) return
    el.accept = DOC_META[t].accept ?? ''
    el.value = ''
    el.click()
  }, [])

  useEffect(() => {
    registerPick(pick)
  }, [registerPick, pick])

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
          Thêm tài liệu
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="theme-v3 max-h-[70vh] w-72 overflow-y-auto"
        >
          {KINDS.map((t) => (
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
