'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
} from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { Textarea } from '@/components/shadcn/textarea'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { uploadFileTracked } from '@/lib/upload'
import type { DieRow, DieSpec, DieStatus } from '@/modules/dept/technical/dies.repo'
import { errText } from '../_lib/err-text'
import { DIE_STATUS_LABEL, kgPerM } from '../_lib/labels'
import {
  DIE_IMAGE_TYPES,
  KhuonImageField,
  dieImageName,
  type DieImage,
} from './KhuonImageField'

/**
 * FORM THÊM / SỬA HỒ SƠ KHUÔN.
 *
 * Một form dùng cho cả hai việc: thêm và sửa chỉ khác nhau ở chỗ có `die` hay
 * không. Tách thành hai form là hai nơi phải nhớ thêm ô mới mỗi lần danh mục nở
 * ra — và một trong hai sẽ bị quên.
 *
 * ⭐ NGƯỜI DÙNG KHÔNG PHẢI TỰ GHI NHẬT KÝ. Đổi tình trạng / nơi giữ / kg/m thì
 * service tự đẻ một dòng sự kiện (xem `dies.service`). Bắt vừa sửa ô vừa nhớ ghi
 * thêm một dòng lịch sử thì sau ba tuần không ai ghi nữa, và ta quay lại đúng
 * chỗ cũ: cả đời cái khuôn nằm trong ô ghi chú.
 *
 * Ô SỐ để trống ≠ 0. "Chưa cân kg/m" và "kg/m bằng 0" là hai chuyện khác nhau,
 * nên ô trống gửi lên chuỗi rỗng và zod ở biên đổi thành `null` — đừng "tiện
 * tay" `?? 0` ở đây.
 *
 * ẢNH MẶT CẮT ĐI CÙNG FORM (29/09/2026, artboard 20 · 20b). Trước đó muốn có
 * ảnh phải thêm khuôn xong, mở hồ sơ, vào tab Mặt cắt rồi mới tải — 46/215
 * khuôn không có ảnh. Lưu là HAI NHỊP: ghi hồ sơ → tải ảnh (khuôn mới chưa có
 * id thì chưa có chỗ đính file). Nhịp hai hỏng thì hồ sơ ĐÃ nằm trong danh mục:
 * nút "Thêm khuôn" phải biến mất, không thì người dùng bấm lại và ra khuôn trùng
 * — thay bằng "Tải lại ảnh" chỉ chạy lại nhịp hai.
 */

const STATUSES: DieStatus[] = [
  'active',
  'pending',
  'rarely_used',
  'broken',
  'replaced',
  'retired',
  'unknown',
]

/** Đủ để báo trùng mã ngay khi gõ và chỉ sang hồ sơ đang có. */
export type DieRef = Pick<DieRow, 'id' | 'code' | 'name' | 'holder_name' | 'weight_per_m'>

type Draft = Record<string, string>

/** Giá trị hiện có → chuỗi cho ô nhập. `null` thành '' chứ không thành "null". */
const s = (v: string | number | null | undefined) => (v == null ? '' : String(v))

function toDraft(die?: (DieRow & DieSpec) | null): Draft {
  return {
    code: s(die?.code),
    name: s(die?.name),
    part_group: s(die?.part_group),
    profile_shape: s(die?.profile_shape),
    alloy: s(die?.alloy),
    weight_per_m: s(die?.weight_per_m),
    unit: s(die?.unit) || 'Bộ',
    die_price: s(die?.die_price),
    holder_name: s(die?.holder_name),
    status: die?.status ?? 'active',
    note: s(die?.note),
    section_a_mm: s(die?.section_a_mm),
    section_b_mm: s(die?.section_b_mm),
    wall_thickness_mm: s(die?.wall_thickness_mm),
    rib_count: s(die?.rib_count),
    bar_length_m: s(die?.bar_length_m),
    pcs_per_bundle: s(die?.pcs_per_bundle),
    weight_tolerance_pct: s(die?.weight_tolerance_pct),
    surface_finish: s(die?.surface_finish),
    marking: s(die?.marking),
  }
}

/**
 * Soát file ảnh — MỘT chỗ cho cả ba đường vào (dán / kéo thả / chọn). Câu từ
 * chối phải nói cách gỡ: bản vẽ khuôn hay là PDF, và đường nhanh nhất từ PDF ra
 * ảnh là chụp vùng mặt cắt rồi dán.
 */
function rejectReason(file: File): string | null {
  if (DIE_IMAGE_TYPES.includes(file.type)) return null
  const how = 'chụp vùng mặt cắt (Win+Shift+S) rồi Ctrl+V vào đây.'
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
    ? `“${file.name}” là PDF, không phải ảnh. Mở bản vẽ, ${how}`
    : `“${file.name}” không phải ảnh PNG / JPG / WebP. Mở file ra, ${how}`
}

export function KhuonFormDialog({
  open,
  onOpenChange,
  die,
  imageUrl,
  existing,
  /** Gợi ý nơi giữ đã có trong danh mục — đỡ gõ và đỡ đẻ ra "Tiến Đat". */
  holderOptions,
  groupOptions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  die?: (DieRow & DieSpec) | null
  /** Ảnh mặt cắt đang dùng trên hồ sơ (chỉ khi sửa). */
  imageUrl?: string | null
  /** Cả danh mục — để chặn trùng mã ngay khi gõ thay vì đợi bấm lưu. */
  existing: DieRef[]
  holderOptions: string[]
  groupOptions: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => toDraft(die))
  const [img, setImg] = useState<DieImage>(() =>
    imageUrl ? { kind: 'current', url: imageUrl } : { kind: 'none' },
  )
  const [imgError, setImgError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const dragDepth = useRef(0)
  const [phase, setPhase] = useState<'idle' | 'saving' | 'uploading'>('idle')
  const [progress, setProgress] = useState(0)
  /** Hồ sơ đã ghi nhưng ảnh hỏng dọc đường (20b · F). */
  const [imgFail, setImgFail] = useState<{
    id: string
    code: string
    message: string
  } | null>(null)

  const busy = phase !== 'idle'
  /** Ô nhập khoá khi đang lưu, và khi hồ sơ đã ghi xong chỉ còn chờ ảnh. */
  const locked = busy || imgFail != null
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  // Ảnh chưa tải lên là blob URL trong bộ nhớ trình duyệt — trả lại khi đổi ảnh
  // hoặc đóng hộp, không thì mỗi lần dán lại rò một bản.
  useEffect(() => {
    if (img.kind !== 'new') return
    const url = img.url
    return () => URL.revokeObjectURL(url)
  }, [img])

  const take = useCallback((file: File, pasted: boolean) => {
    const why = rejectReason(file)
    setImgError(why)
    if (!why) setImg({ kind: 'new', file, url: URL.createObjectURL(file), pasted })
  }, [])

  /*
   * Ctrl+V ở BẤT KỲ ĐÂU trong hộp — nghe ở `document` vì hộp là modal: lúc nó
   * mở thì mọi cú dán đều là dán vào nó, kể cả khi con trỏ đang không đứng ở ô
   * nào. Ngoại lệ: chép ô từ Excel mang theo CẢ chữ lẫn ảnh chụp vùng ô; đang
   * đứng trong ô nhập mà có chữ thì người dùng đang dán CHỮ — để yên.
   */
  useEffect(() => {
    if (!open || busy) return
    function onPaste(e: ClipboardEvent) {
      const data = e.clipboardData
      const file = [...(data?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (!file) return
      const target = e.target instanceof Element ? e.target : null
      if (target?.closest('input, textarea') && data?.types.includes('text/plain')) return
      e.preventDefault()
      take(file, true)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [open, busy, take])

  // Kéo thả nhận trên CẢ HỘP, không bắt người dùng nhắm đúng ô ảnh 216px.
  // Đếm sâu vì dragenter/dragleave bắn ở từng phần tử con khi rê qua.
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files')
  const dragProps = {
    onDragEnter: (e: React.DragEvent) => {
      if (busy || !hasFiles(e)) return
      dragDepth.current += 1
      setDragging(true)
    },
    onDragOver: (e: React.DragEvent) => {
      if (!busy && hasFiles(e)) e.preventDefault()
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      dragDepth.current = 0
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file && !busy) take(file, false)
    },
  }

  /*
   * Trùng mã — so ĐÚNG như service so (`findByCode`: bỏ khoảng trắng đầu cuối,
   * không phân biệt hoa thường), và khi sửa thì chỉ so lúc mã ĐỔI: danh mục cũ
   * có sẵn vài mã trùng nhau (TD-B107 ×2), chặn cả lúc không đổi mã là khoá
   * luôn việc sửa hai khuôn đó. Service vẫn chặn lần cuối.
   */
  const dup = useMemo(() => {
    const code = draft.code.trim()
    if (!code || (die && code === die.code)) return null
    const key = code.toLowerCase()
    return (
      existing.find((d) => d.id !== die?.id && d.code.trim().toLowerCase() === key) ??
      null
    )
  }, [draft.code, die, existing])

  function clearImage() {
    setImgError(null)
    setImg(imageUrl ? { kind: 'removed', url: imageUrl } : { kind: 'none' })
  }

  /** Nhịp hai: tải / bỏ ảnh. `false` = hỏng, hộp chuyển sang trạng thái F. */
  async function pushImage(id: string): Promise<boolean> {
    if (img.kind !== 'new' && img.kind !== 'removed') return true
    setPhase('uploading')
    setProgress(0)
    try {
      if (img.kind === 'removed') {
        await api(`/api/dept/technical/dies/${id}/image`, { method: 'DELETE' })
      } else {
        const file = new File([img.file], dieImageName(img, draft.code), {
          type: img.file.type,
        })
        const fileId = await uploadFileTracked(
          file,
          { kind: 'die', id },
          'attachments',
          'image',
          setProgress,
        )
        await api(`/api/dept/technical/dies/${id}/image`, {
          method: 'POST',
          body: { file_id: fileId },
        })
      }
      return true
    } catch (e) {
      setImgFail({
        id,
        code: draft.code.trim(),
        message: errText(e, 'Không tải được ảnh'),
      })
      // Hồ sơ ĐÃ ghi — màn phía sau phải thấy ngay, kể cả khi người dùng đóng hộp.
      router.refresh()
      return false
    } finally {
      setPhase('idle')
    }
  }

  function finish(message: string) {
    toast.success(message)
    onOpenChange(false)
    router.refresh()
  }

  async function submit() {
    const code = draft.code.trim()
    if (!code) {
      toast.error('Chưa nhập mã khuôn')
      return
    }
    if (dup) return
    setPhase('saving')
    let id: string
    try {
      if (die) {
        await api(`/api/dept/technical/dies/${die.id}`, { method: 'PATCH', body: draft })
        id = die.id
      } else {
        const res = await api<{ id: string }>('/api/dept/technical/dies', {
          method: 'POST',
          body: draft,
        })
        id = res.id
      }
    } catch (e) {
      toast.error(apiErrorText(e, 'Không lưu được'))
      setPhase('idle')
      return
    }
    if (!(await pushImage(id))) return
    if (die) finish('Đã lưu hồ sơ khuôn')
    else if (img.kind === 'new') finish(`Đã thêm khuôn ${code} kèm ảnh mặt cắt`)
    else finish('Đã thêm khuôn vào danh mục')
  }

  async function retry() {
    if (!imgFail) return
    const { id, code } = imgFail
    setImgFail(null)
    if (await pushImage(id)) {
      finish(die ? 'Đã lưu ảnh mặt cắt' : `Đã thêm ảnh mặt cắt cho khuôn ${code}`)
    }
  }

  const canRetry = img.kind === 'new' || img.kind === 'removed'
  const shownCode = imgFail?.code ?? draft.code.trim()

  return (
    <Dialog
      open={open}
      // Đang ghi thì không cho đóng: đóng giữa hai nhịp là khuôn có mà ảnh mất,
      // và không ai được báo.
      onOpenChange={(v) => (v || !busy) && onOpenChange(v)}
    >
      {/*
        Chân hộp GHIM (Q3): form cao ~850px mà hộp chặn ở 90vh — ở 1280×800 nút
        lưu từng nằm dưới đáy, phải cuộn mới thấy. Thân cuộn, chân đứng yên.
      */}
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]"
        {...dragProps}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6 pb-4">
          <DialogHeader className="pr-6">
            <DialogTitle>{die ? `Sửa khuôn ${die.code}` : 'Thêm khuôn nhôm'}</DialogTitle>
            <DialogDescription>
              Đổi tình trạng, nơi giữ hay kg/m thì hệ thống tự ghi một dòng vào nhật ký
              đời khuôn — không phải tự gõ thêm.
            </DialogDescription>
          </DialogHeader>

          {phase === 'uploading' && (
            <div className="flex gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--done)_30%,transparent)] bg-[color-mix(in_srgb,var(--done)_7%,transparent)] p-3 text-sm">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-[var(--done)]"
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span>
                  <b>{die ? 'Đã lưu hồ sơ.' : `Đã thêm khuôn ${shownCode}.`}</b>{' '}
                  {img.kind === 'removed'
                    ? 'Đang bỏ ảnh cũ…'
                    : 'Đang tải ảnh mặt cắt lên…'}
                </span>
                {img.kind === 'new' && (
                  <progress
                    value={progress}
                    max={100}
                    aria-label="Tiến độ tải ảnh"
                    className="[&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:bg-primary h-1 w-full appearance-none overflow-hidden rounded-full"
                  />
                )}
              </div>
            </div>
          )}

          {imgFail && (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_8%,transparent)] p-3 text-sm"
            >
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-[var(--warn)]"
                aria-hidden
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span>
                  <b>
                    {die
                      ? 'Đã lưu hồ sơ — nhưng ảnh chưa lên:'
                      : `Đã thêm khuôn ${imgFail.code} vào danh mục — nhưng ảnh chưa lên:`}
                  </b>{' '}
                  {imgFail.message}
                </span>
                {!die && (
                  <span className="text-muted-foreground text-xs">
                    Khuôn đã có rồi; bấm “Thêm khuôn” lần nữa là ra khuôn trùng, nên nút
                    đó đã được thay bằng hai nút dưới.
                  </span>
                )}
              </div>
            </div>
          )}

          <Section title="Nhận diện" className="grid gap-4 sm:grid-cols-[216px_1fr]">
            <KhuonImageField
              value={img}
              code={draft.code}
              saveLabel={imgFail ? 'Tải lại ảnh' : die ? 'Lưu thay đổi' : 'Thêm khuôn'}
              dragging={dragging}
              error={imgError}
              disabled={busy}
              onPick={(f) => take(f, false)}
              onClear={clearImage}
              onUndoRemove={() => imageUrl && setImg({ kind: 'current', url: imageUrl })}
            />
            <fieldset
              disabled={locked}
              className="grid min-w-0 grid-cols-2 content-start gap-3"
            >
              <Field label="Mã khuôn" required>
                <Input
                  value={draft.code}
                  onChange={(e) => set('code', e.target.value)}
                  placeholder="TD-B108"
                  aria-invalid={!!dup}
                  className="font-mono"
                />
                {dup && (
                  <span
                    role="alert"
                    className="text-destructive flex items-start gap-1.5 text-xs"
                  >
                    <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                    <span>
                      Đã có trong danh mục: {dup.name ?? 'chưa ghi tên'} ·{' '}
                      {dup.holder_name ?? 'chưa ghi nơi giữ'}
                      {dup.weight_per_m != null &&
                        ` · ${kgPerM(dup.weight_per_m)} kg/m`}.{' '}
                      <Link
                        href={`/khuon/${dup.id}`}
                        className="text-primary font-medium"
                      >
                        Mở hồ sơ {dup.code}
                        <ExternalLink
                          className="ml-0.5 inline size-3 align-[-1px]"
                          aria-hidden
                        />
                      </Link>
                    </span>
                  </span>
                )}
              </Field>
              <Field label="Tên chi tiết">
                <Input
                  value={draft.name}
                  onChange={(e) => set('name', e.target.value)}
                  placeholder="Chân bàn U 80x120"
                />
              </Field>
              <Field label="Nhóm chi tiết">
                <Input
                  value={draft.part_group}
                  onChange={(e) => set('part_group', e.target.value)}
                  list="khuon-groups"
                  placeholder="Chân, Diềm bàn, Tựa lưng…"
                />
                <datalist id="khuon-groups">
                  {groupOptions.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </Field>
              <Field label="Dạng profile">
                <Input
                  value={draft.profile_shape}
                  onChange={(e) => set('profile_shape', e.target.value)}
                  placeholder="Hộp vuông, Oval, La…"
                />
              </Field>
              <Field label="Hợp kim">
                <Input
                  value={draft.alloy}
                  onChange={(e) => set('alloy', e.target.value)}
                  placeholder="Nhôm 6063"
                />
              </Field>
              <Field label="ĐVT">
                <Input value={draft.unit} onChange={(e) => set('unit', e.target.value)} />
              </Field>
            </fieldset>
          </Section>

          <fieldset disabled={locked} className="flex min-w-0 flex-col gap-4">
            <Section title="Tình trạng & nơi giữ">
              <Field label="Tình trạng">
                <Select value={draft.status} onValueChange={(v) => set('status', v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {DIE_STATUS_LABEL[st]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nơi giữ khuôn">
                <Input
                  value={draft.holder_name}
                  onChange={(e) => set('holder_name', e.target.value)}
                  list="khuon-holders"
                  placeholder="Tiến Đạt"
                />
                <datalist id="khuon-holders">
                  {holderOptions.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </Field>
              <Field label="Trọng lượng kg/m">
                <Input
                  value={draft.weight_per_m}
                  onChange={(e) => set('weight_per_m', e.target.value)}
                  inputMode="decimal"
                  placeholder="0.757"
                  className="font-mono"
                />
              </Field>
              <Field label="Tiền mở khuôn (₫)">
                <Input
                  value={draft.die_price}
                  onChange={(e) => set('die_price', e.target.value)}
                  inputMode="numeric"
                  placeholder="12090000"
                  className="font-mono"
                />
              </Field>
            </Section>

            {/*
              Khối này là lý do danh mục khuôn đáng làm với XƯỞNG, không chỉ với
              Kỹ thuật: đo 13/09/2026 trên 462 dòng định mức có ghi mã khuôn thì
              kg/m chỉ 1%, chiều dài cây 0%, số phôi/cây 0% — xưởng biết cắt dài
              bao nhiêu mà không chỗ nào đổi ra "mấy cây nhôm". Ba số thiếu đó đều
              là thuộc tính của KHUÔN. Xem §4 docs/quan-ly-khuon-ke-hoach.md.
            */}
            <Section
              title="Thông số cho sản xuất"
              hint="Để trống nếu chưa đo — trống không phải là 0."
            >
              <Field label="Tiết diện A (mm)">
                <Input
                  value={draft.section_a_mm}
                  onChange={(e) => set('section_a_mm', e.target.value)}
                  inputMode="decimal"
                  className="font-mono"
                />
              </Field>
              <Field label="Tiết diện B (mm)">
                <Input
                  value={draft.section_b_mm}
                  onChange={(e) => set('section_b_mm', e.target.value)}
                  inputMode="decimal"
                  className="font-mono"
                />
              </Field>
              <Field label="Độ dày thành (mm)">
                <Input
                  value={draft.wall_thickness_mm}
                  onChange={(e) => set('wall_thickness_mm', e.target.value)}
                  inputMode="decimal"
                  className="font-mono"
                />
              </Field>
              <Field label="Số gân">
                <Input
                  value={draft.rib_count}
                  onChange={(e) => set('rib_count', e.target.value)}
                  inputMode="numeric"
                  className="font-mono"
                />
              </Field>
              <Field label="Chiều dài cây (m)">
                <Input
                  value={draft.bar_length_m}
                  onChange={(e) => set('bar_length_m', e.target.value)}
                  inputMode="decimal"
                  placeholder="6"
                  className="font-mono"
                />
              </Field>
              <Field label="Số cây / bó">
                <Input
                  value={draft.pcs_per_bundle}
                  onChange={(e) => set('pcs_per_bundle', e.target.value)}
                  inputMode="numeric"
                  className="font-mono"
                />
              </Field>
              <Field label="Dung sai trọng lượng (%)">
                <Input
                  value={draft.weight_tolerance_pct}
                  onChange={(e) => set('weight_tolerance_pct', e.target.value)}
                  inputMode="decimal"
                  placeholder="5"
                  className="font-mono"
                />
              </Field>
              <Field label="Bề mặt">
                <Input
                  value={draft.surface_finish}
                  onChange={(e) => set('surface_finish', e.target.value)}
                  placeholder="Mộc / anod / sơn"
                />
              </Field>
              <Field label="Dấu in trên cây">
                <Input
                  value={draft.marking}
                  onChange={(e) => set('marking', e.target.value)}
                />
              </Field>
            </Section>

            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Ghi chú</span>
              <Textarea
                value={draft.note}
                onChange={(e) => set('note', e.target.value)}
                rows={3}
              />
            </div>
          </fieldset>
        </div>

        <DialogFooter className="items-center border-t px-6 py-3">
          {dup ? (
            <span className="text-destructive flex items-center gap-1.5 text-xs sm:mr-auto">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Mã {dup.code} đã có — đổi mã hoặc mở hồ sơ cũ
            </span>
          ) : (
            !locked && (
              <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:mr-auto sm:flex">
                <ClipboardPaste className="size-3.5 shrink-0" aria-hidden />
                Ctrl+V ở bất kỳ đâu trong hộp này là{' '}
                {img.kind === 'new' || img.kind === 'current' ? 'thay ảnh' : 'gắn ảnh'}
              </span>
            )
          )}

          {imgFail ? (
            <>
              {die ? (
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Để sau
                </Button>
              ) : (
                <Button variant="outline" asChild>
                  <Link href={`/khuon/${imgFail.id}`}>
                    <ExternalLink /> Để sau, mở hồ sơ
                  </Link>
                </Button>
              )}
              <Button onClick={() => void retry()} disabled={!canRetry}>
                <RotateCcw /> {img.kind === 'removed' ? 'Thử bỏ ảnh lại' : 'Tải lại ảnh'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Huỷ
              </Button>
              <Button onClick={() => void submit()} disabled={busy || !!dup}>
                {busy ? <Spinner size={14} /> : die ? <Save /> : <Plus />}
                {phase === 'uploading'
                  ? `Đang tải ảnh… ${progress}%`
                  : phase === 'saving'
                    ? 'Đang lưu…'
                    : die
                      ? 'Lưu thay đổi'
                      : 'Thêm khuôn'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  hint,
  className = 'grid grid-cols-2 gap-3 sm:grid-cols-3',
  children,
}: {
  title: string
  hint?: string
  /** Lưới bên trong khối — khối Nhận diện đổi sang hai cột ảnh | ô nhập. */
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      <div className={className}>{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        {label}
        {required && <span className="text-[var(--stop)]"> *</span>}
      </span>
      {children}
    </label>
  )
}
