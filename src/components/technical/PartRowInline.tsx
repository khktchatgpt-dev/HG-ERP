'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Trash2 } from 'lucide-react'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { SHAPE_OPTIONS, calcPartDerived, isCalculable } from '@/lib/bom-calc'
import type { PartView } from './ProductProfileCards'

const inp =
  'w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs hover:border-zinc-300 focus:border-sky-500 focus:bg-background focus:outline-none dark:hover:border-zinc-700'

/** Các ô sửa được tại chỗ. Bỏ qua các cột dẫn xuất — chúng tự tính. */
type Draft = {
  part_no: string
  part_name: string
  profile_shape: string
  dim_a_mm: string
  dim_b_mm: string
  wall_thickness_mm: string
  cut_length_mm: string
  qty: string
  unit: string
  note: string
}

const s = (v: unknown) => (v == null ? '' : String(v))
const nOrNull = (v: string) => {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const x = Number(t)
  return Number.isFinite(x) ? x : null
}

const fromPart = (p: PartView): Draft => ({
  part_no: s(p.part_no),
  part_name: p.part_name,
  profile_shape: s(p.profile_shape),
  dim_a_mm: s(p.dim_a_mm),
  dim_b_mm: s(p.dim_b_mm),
  wall_thickness_mm: s(p.wall_thickness_mm),
  cut_length_mm: s(p.cut_length_mm),
  qty: s(p.qty),
  unit: s(p.unit),
  note: s(p.note),
})

const EMPTY: Draft = {
  part_no: '',
  part_name: '',
  profile_shape: '',
  dim_a_mm: '',
  dim_b_mm: '',
  wall_thickness_mm: '',
  cut_length_mm: '',
  qty: '',
  unit: '',
  note: '',
}

/** Thân yêu cầu gửi lên — dùng chung cho sửa và thêm. */
const toBody = (d: Draft, materialKind: string | null) => {
  const geo = {
    profile_shape: d.profile_shape || null,
    material_kind: materialKind,
    dim_a_mm: nOrNull(d.dim_a_mm),
    dim_b_mm: nOrNull(d.dim_b_mm),
    wall_thickness_mm: nOrNull(d.wall_thickness_mm),
    cut_length_mm: nOrNull(d.cut_length_mm),
    qty: nOrNull(d.qty),
  }
  const der = calcPartDerived(geo)
  return {
    ...geo,
    part_no: nOrNull(d.part_no),
    part_name: d.part_name.trim(),
    unit: d.unit.trim() || null,
    note: d.note.trim() || null,
    total_length_m: der.total_length_m,
    paint_area_m2: der.paint_area_m2,
    _weight: der.weight_kg,
  }
}

function Cells({
  draft,
  set,
  onEnter,
  weight,
  shapeOff,
  nameRef,
}: {
  draft: Draft
  set: (k: keyof Draft, v: string) => void
  onEnter: () => void
  weight: number | null
  shapeOff: boolean
  /** Ô tên — dòng thêm mới cần giữ để trả con trỏ về sau khi lưu. */
  nameRef?: React.RefObject<HTMLInputElement | null>
}) {
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onEnter()
    }
  }
  const numCells: [keyof Draft, string][] = [
    ['dim_a_mm', 'Dày A'],
    ['dim_b_mm', 'Rộng B'],
    ['wall_thickness_mm', 'Dày thành'],
    ['cut_length_mm', 'Dài cắt'],
    ['qty', 'SL'],
  ]
  return (
    <>
      <td className="py-0.5 pr-1">
        <input
          value={draft.part_no}
          onChange={(e) => set('part_no', e.target.value)}
          onKeyDown={key}
          className={`${inp} text-right`}
          aria-label="STT"
        />
      </td>
      <td className="py-0.5 pr-2">
        <input
          ref={nameRef}
          value={draft.part_name}
          onChange={(e) => set('part_name', e.target.value)}
          onKeyDown={key}
          className={inp}
          placeholder="Tên chi tiết…"
          aria-label="Tên chi tiết"
        />
      </td>
      <td className="py-0.5 pr-2">
        <select
          value={draft.profile_shape}
          onChange={(e) => set('profile_shape', e.target.value)}
          className={inp}
          aria-label="Dạng"
        >
          <option value="">—</option>
          {SHAPE_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      {numCells.map(([k, label]) => (
        <td key={k} className="py-0.5 pr-1">
          <input
            value={draft[k]}
            onChange={(e) => set(k, e.target.value)}
            onKeyDown={key}
            inputMode="decimal"
            className={`${inp} text-right`}
            aria-label={label}
          />
        </td>
      ))}
      <td className="py-0.5 pr-1">
        <input
          value={draft.unit}
          onChange={(e) => set('unit', e.target.value)}
          onKeyDown={key}
          className={inp}
          aria-label="ĐVT"
        />
      </td>
      <td
        className="text-muted-foreground py-0.5 pr-2 text-right text-xs tabular-nums"
        title={
          shapeOff ? 'Dạng này tiết diện tuỳ ý — không tính được khối lượng' : undefined
        }
      >
        {weight != null ? weight.toFixed(3) : shapeOff ? '—' : ''}
      </td>
      <td className="py-0.5 pr-1">
        <input
          value={draft.note}
          onChange={(e) => set('note', e.target.value)}
          onKeyDown={key}
          className={inp}
          aria-label="Ghi chú"
        />
      </td>
    </>
  )
}

/**
 * Một dòng định mức SỬA TẠI CHỖ. Lưu khi rời khỏi dòng (blur ra ngoài) hoặc Enter
 * — không có nút Lưu, để nhập liên tục như bảng tính.
 */
export function PartRowInline({
  productId,
  part,
  colSpanExtra,
  onDeleted,
}: {
  productId: string
  part: PartView
  colSpanExtra: number
  onDeleted: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => fromPart(part))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const saving = useRef(false)
  const rowRef = useRef<HTMLTableRowElement>(null)

  // Đồng bộ khi server trả dữ liệu mới (sau router.refresh). Điều chỉnh state
  // ngay trong render — đúng cách React khuyên — thay vì setState trong effect.
  //
  // Chỉ ghi đè khi người dùng KHÔNG sửa dở: dòng khác lưu cũng làm mới cả trang,
  // ghi đè vô điều kiện sẽ xoá mất phần đang gõ ở dòng này.
  const serverSnapshot = JSON.stringify(fromPart(part))
  const [baseline, setBaseline] = useState(serverSnapshot)
  if (serverSnapshot !== baseline) {
    setBaseline(serverSnapshot)
    if (JSON.stringify(draft) === baseline) setDraft(fromPart(part))
  }

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const body = toBody(draft, part.material_kind)
  const dirty = serverSnapshot !== JSON.stringify(draft)

  async function save() {
    if (!dirty || saving.current) return
    if (!body.part_name) return
    if (!(body.qty && body.qty > 0)) return
    saving.current = true
    setBusy(true)
    try {
      const { _weight, ...rest } = body
      await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
        method: 'PATCH',
        body: { ...rest, weight_kg: part.weight_kg ?? _weight },
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
      router.refresh()
    } catch (err) {
      toast.error('Lưu dòng thất bại', apiErrorText(err))
    } finally {
      saving.current = false
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
        method: 'DELETE',
      })
      onDeleted()
      router.refresh()
    } catch (err) {
      toast.error('Xoá thất bại', apiErrorText(err))
      setBusy(false)
    }
  }

  return (
    <tr
      ref={rowRef}
      // Rời khỏi dòng (không còn ô nào trong dòng được focus) thì lưu.
      onBlur={(e) => {
        if (!rowRef.current?.contains(e.relatedTarget as Node | null)) void save()
      }}
      className={busy ? 'border-b opacity-60' : 'border-b last:border-0'}
    >
      <Cells
        draft={draft}
        set={set}
        onEnter={() => void save()}
        weight={part.weight_kg ?? body._weight}
        shapeOff={!!draft.profile_shape && !isCalculable(draft.profile_shape)}
      />
      <td className="py-0.5" colSpan={colSpanExtra}>
        <div className="flex items-center justify-end gap-1">
          {saved && <Check className="size-3.5 text-emerald-600" />}
          {dirty && !saved && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400">
              chưa lưu
            </span>
          )}
          <button
            type="button"
            onClick={() => void remove()}
            title="Xoá dòng"
            className="hover:bg-muted rounded p-1"
          >
            <Trash2 className="text-muted-foreground size-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

/**
 * Dòng TRỐNG ở cuối mỗi khối — gõ tên + số lượng rồi Enter là tạo dòng mới, và
 * dòng trống mới lại xuất hiện. Đây là vòng "tạo định mức trực tiếp trên bảng".
 */
export function PartRowNew({
  productId,
  groupCode,
  sectionTitle,
  unitBasis,
  setItemLabel,
  materialKind,
  colSpanExtra,
}: {
  productId: string
  groupCode: string
  sectionTitle: string | null
  unitBasis: string | null
  setItemLabel: string | null
  materialKind: string | null
  colSpanExtra: number
}) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const body = toBody(draft, materialKind)
  const ready = !!body.part_name && !!body.qty && body.qty > 0

  async function create() {
    if (!ready || busy) return
    setBusy(true)
    try {
      const { _weight, ...rest } = body
      await api(`/api/dept/technical/products/${productId}/parts`, {
        method: 'POST',
        body: {
          ...rest,
          weight_kg: _weight,
          group_code: groupCode,
          section_title: sectionTitle,
          unit_basis: unitBasis,
          set_item_label: setItemLabel,
        },
      })
      setDraft(EMPTY)
      router.refresh()
      // Con trỏ về ô tên để gõ dòng tiếp — nhập liên tục không cần chuột.
      //
      // Phải focus SAU khi router.refresh() render lại, không thì lần render đó
      // xoá mất focus (đã gặp: gõ Enter xong con trỏ rơi về body). refresh không
      // trả promise nên không await được — thử lại vài nhịp cho chắc.
      const back = () => nameRef.current?.focus()
      back()
      requestAnimationFrame(back)
      setTimeout(back, 350)
    } catch (err) {
      toast.error('Thêm dòng thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className={busy ? 'bg-muted/20 opacity-60' : 'bg-muted/20'}>
      <Cells
        draft={draft}
        set={set}
        onEnter={() => void create()}
        weight={body._weight}
        shapeOff={!!draft.profile_shape && !isCalculable(draft.profile_shape)}
        nameRef={nameRef}
      />
      <td className="py-0.5" colSpan={colSpanExtra}>
        <button
          type="button"
          onClick={() => void create()}
          disabled={!ready || busy}
          className="text-primary w-full text-right text-[10px] font-medium hover:underline disabled:opacity-40"
        >
          {busy ? '…' : 'Thêm'}
        </button>
      </td>
    </tr>
  )
}
