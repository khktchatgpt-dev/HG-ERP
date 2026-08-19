'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { calcPartDerived, isCalculable, pcsPerBarFrom } from '@/lib/bom-calc'
import {
  derivedPreviewFor,
  inputCellsFor,
  type InputCell,
  type InputKey,
} from './part-layouts'
import { PartField } from './PartField'
import type { PartView } from './ProductProfileCards'

const inp =
  'hover:border-input focus:border-[var(--primary)] focus:bg-background w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs focus:outline-none'

/**
 * Bản nháp một dòng đang gõ. Chứa MỌI trường của mọi họ khối; ô nào thật sự hiện
 * do `inputCellsFor(group)` quyết định — xem `part-layouts.ts`. Bốn số dẫn xuất
 * (tổng dài · khối lượng · diện tích · m³) NAY CŨNG LÀ Ô NHẬP: biểu mẫu giấy có
 * đủ bốn cột và xưởng vẫn ghi tay (bảng cân NCC, profile gân không suy từ hình
 * học được). Bỏ trống thì `calcPartDerived` điền hộ.
 */
type Draft = Record<InputKey, string>

const EMPTY: Draft = {
  part_no: '',
  cluster_name: '',
  part_name: '',
  profile_shape: '',
  dim_a_mm: '',
  dim_b_mm: '',
  wall_thickness_mm: '',
  cut_length_mm: '',
  bend_waste_mm: '',
  tenon_mm: '',
  qty: '',
  unit: '',
  material_note: '',
  color: '',
  note: '',
  profile_code: '',
  kg_per_m: '',
  wood_species: '',
  bar_length_m: '',
  pcs_per_bar: '',
  roll_width_m: '',
  waste_pct: '',
  sheet_w_mm: '',
  sheet_l_mm: '',
  m3_per_sheet: '',
  total_length_m: '',
  weight_kg: '',
  paint_area_m2: '',
  volume_m3: '',
}

const s = (v: unknown) => (v == null ? '' : String(v))
const nOrNull = (v: string) => {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const x = Number(t)
  return Number.isFinite(x) ? x : null
}

export const fromPart = (p: PartView, clusterName: string | null): Draft => ({
  part_no: s(p.part_no),
  cluster_name: clusterName ?? '',
  part_name: p.part_name,
  profile_shape: s(p.profile_shape),
  dim_a_mm: s(p.dim_a_mm),
  dim_b_mm: s(p.dim_b_mm),
  wall_thickness_mm: s(p.wall_thickness_mm),
  cut_length_mm: s(p.cut_length_mm),
  bend_waste_mm: s(p.bend_waste_mm),
  tenon_mm: s(p.tenon_mm),
  qty: s(p.qty),
  unit: s(p.unit),
  material_note: s(p.material_note),
  color: s(p.color),
  note: s(p.note),
  profile_code: s(p.profile_code),
  kg_per_m: s(p.kg_per_m),
  wood_species: s(p.wood_species),
  bar_length_m: s(p.bar_length_m),
  pcs_per_bar: s(p.pcs_per_bar),
  roll_width_m: s(p.roll_width_m),
  waste_pct: s(p.waste_pct),
  sheet_w_mm: s(p.sheet_w_mm),
  sheet_l_mm: s(p.sheet_l_mm),
  m3_per_sheet: s(p.m3_per_sheet),
  total_length_m: s(p.total_length_m),
  weight_kg: s(p.weight_kg),
  paint_area_m2: s(p.paint_area_m2),
  volume_m3: s(p.volume_m3),
})

/** Thân yêu cầu gửi lên — dùng chung cho sửa và thêm. */
export const toBody = (d: Draft, materialKind: string | null) => {
  const geo = {
    profile_shape: d.profile_shape || null,
    material_kind: materialKind,
    dim_a_mm: nOrNull(d.dim_a_mm),
    dim_b_mm: nOrNull(d.dim_b_mm),
    wall_thickness_mm: nOrNull(d.wall_thickness_mm),
    cut_length_mm: nOrNull(d.cut_length_mm),
    bend_waste_mm: nOrNull(d.bend_waste_mm),
    tenon_mm: nOrNull(d.tenon_mm),
    kg_per_m: nOrNull(d.kg_per_m),
    qty: nOrNull(d.qty),
  }
  const der = calcPartDerived(geo)
  // Số khúc trên cây SUY từ chiều dài — người nhập bỏ trống là dùng số suy ra,
  // gõ số khác thì số của họ thắng (xưởng chừa hao nhiều hơn lý thuyết).
  const barLen = nOrNull(d.bar_length_m)
  const pcsAuto = pcsPerBarFrom(geo.cut_length_mm, geo.bend_waste_mm, barLen)
  return {
    ...geo,
    part_no: nOrNull(d.part_no),
    part_name: d.part_name.trim(),
    // Chuỗi rỗng phải thành null chứ không phải "" — bỏ trống ô Cụm nghĩa là đưa
    // dòng về nhóm Rời, còn undefined thì server hiểu là "không đụng tới cụm".
    cluster_name: d.cluster_name.trim() || null,
    unit: d.unit.trim() || null,
    material_note: d.material_note.trim() || null,
    color: d.color.trim() || null,
    note: d.note.trim() || null,
    // Quy đổi đơn vị mua (0132) — ô nào không thuộc họ khối đang gõ thì luôn
    // rỗng, gửi null nên không đụng dữ liệu cũ.
    profile_code: d.profile_code.trim() || null,
    wood_species: d.wood_species.trim() || null,
    bar_length_m: barLen,
    pcs_per_bar: nOrNull(d.pcs_per_bar) ?? pcsAuto,
    roll_width_m: nOrNull(d.roll_width_m),
    waste_pct: nOrNull(d.waste_pct),
    sheet_w_mm: nOrNull(d.sheet_w_mm),
    sheet_l_mm: nOrNull(d.sheet_l_mm),
    m3_per_sheet: nOrNull(d.m3_per_sheet),
    // Số NGƯỜI NHẬP thắng, hệ chỉ điền vào ô còn trống — cùng luật với
    // `technical.service.ts`, để hai đường ghi không cho ra hai kết quả.
    total_length_m: nOrNull(d.total_length_m) ?? der.total_length_m,
    weight_kg: nOrNull(d.weight_kg) ?? der.weight_kg,
    paint_area_m2: nOrNull(d.paint_area_m2) ?? der.paint_area_m2,
    volume_m3: nOrNull(d.volume_m3) ?? der.volume_m3,
    _derived: der,
  }
}

/** Các ô của một dòng, dựng theo họ khối. */
function Cells({
  cells,
  draft,
  set,
  setMany,
  onEnter,
  preview,
  shapeOff,
  nameRef,
}: {
  cells: InputCell[]
  draft: Draft
  set: (k: InputKey, v: string) => void
  /** Chọn từ danh mục điền một lúc nhiều ô — phải gộp vào MỘT lần setState. */
  setMany: (patch: Partial<Draft>) => void
  onEnter: () => void
  /** Số tự tính hiện ở cuối lưới (KL hoặc m³) — null nếu họ khối không có. */
  preview: { label: string; value: number | null; digits: number } | null
  shapeOff: boolean
  /** Ô tên — dòng thêm mới cần giữ để trả con trỏ về sau khi lưu. */
  nameRef?: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <>
      {cells.map((c) => (
        <td key={c.key} className="py-0.5 pr-1">
          <PartField
            cell={c}
            draft={draft}
            set={set}
            setMany={setMany}
            onEnter={onEnter}
            className={cn(inp, c.kind === 'num' && 'text-right')}
            inputRef={c.key === 'part_name' ? nameRef : undefined}
          />
        </td>
      ))}
      {preview && (
        <td
          className="text-muted-foreground py-0.5 pr-2 text-right text-xs tabular-nums"
          title={
            shapeOff ? 'Dạng này tiết diện tuỳ ý — không tính được khối lượng' : undefined
          }
        >
          {preview.value != null
            ? preview.value.toFixed(preview.digits)
            : shapeOff
              ? '—'
              : ''}
        </td>
      )}
    </>
  )
}

/** Số cột của lưới nhập một họ khối — để tính colSpan cho dải tiêu đề. */
export function inlineColSpan(groupCode: string): number {
  return inputCellsFor(groupCode).length + (derivedPreviewFor(groupCode) ? 1 : 0) + 1
}

/** Hàng tiêu đề của lưới nhập — cùng nguồn định nghĩa với các ô. */
export function InlineHead({ groupCode }: { groupCode: string }) {
  const cells = inputCellsFor(groupCode)
  const preview = derivedPreviewFor(groupCode)
  return (
    <tr className="text-muted-foreground border-b text-left text-[11px] uppercase">
      {cells.map((c) => (
        <th
          key={c.key}
          className={cn(c.w, 'py-1.5 pr-1 font-medium', c.kind === 'num' && 'text-right')}
        >
          {c.label}
        </th>
      ))}
      {preview && (
        <th className="w-20 py-1.5 pr-2 text-right font-medium">{preview.label}</th>
      )}
      <th className="w-16 py-1.5" />
    </tr>
  )
}

function usePreview(draft: Draft, materialKind: string | null, groupCode: string) {
  const body = toBody(draft, materialKind)
  const spec = derivedPreviewFor(groupCode)
  const preview = spec
    ? { label: spec.label, value: body._derived[spec.key], digits: spec.digits }
    : null
  return { body, preview }
}

/**
 * Một dòng định mức SỬA TẠI CHỖ. Lưu khi rời khỏi dòng (blur ra ngoài) hoặc Enter
 * — không có nút Lưu, để nhập liên tục như bảng tính.
 */
export function PartRowInline({
  productId,
  part,
  groupCode,
  clusterName,
  onDeleted,
}: {
  productId: string
  part: PartView
  groupCode: string
  /** Tên cụm hiện tại của dòng — đổ vào ô Cụm để sửa được ngay trên dòng. */
  clusterName: string | null
  onDeleted: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>(() => fromPart(part, clusterName))
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const saving = useRef(false)
  const rowRef = useRef<HTMLTableRowElement>(null)

  // Đồng bộ khi server trả dữ liệu mới (sau router.refresh). Điều chỉnh state
  // ngay trong render — đúng cách React khuyên — thay vì setState trong effect.
  //
  // Chỉ ghi đè khi người dùng KHÔNG sửa dở: dòng khác lưu cũng làm mới cả trang,
  // ghi đè vô điều kiện sẽ xoá mất phần đang gõ ở dòng này.
  const serverSnapshot = JSON.stringify(fromPart(part, clusterName))
  const [baseline, setBaseline] = useState(serverSnapshot)
  if (serverSnapshot !== baseline) {
    setBaseline(serverSnapshot)
    if (JSON.stringify(draft) === baseline) setDraft(fromPart(part, clusterName))
  }

  const set = (k: InputKey, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const setMany = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const { body, preview } = usePreview(draft, part.material_kind, groupCode)
  const dirty = serverSnapshot !== JSON.stringify(draft)

  async function save() {
    if (!dirty || saving.current) return
    if (!body.part_name) return
    if (!(body.qty && body.qty > 0)) return
    saving.current = true
    setBusy(true)
    try {
      const { _derived, ...rest } = body
      await api(`/api/dept/technical/products/${productId}/parts/${part.id}`, {
        method: 'PATCH',
        body: { ...rest, weight_kg: part.weight_kg ?? _derived.weight_kg },
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
        cells={inputCellsFor(groupCode)}
        draft={draft}
        set={set}
        setMany={setMany}
        onEnter={() => void save()}
        preview={
          preview && preview.label.startsWith('KL')
            ? { ...preview, value: part.weight_kg ?? preview.value }
            : preview
        }
        shapeOff={!!draft.profile_shape && !isCalculable(draft.profile_shape)}
      />
      <td className="py-0.5">
        <div className="flex items-center justify-end gap-1">
          {saved && <Check className="size-3.5 text-emerald-600" />}
          {dirty && !saved && (
            <span className="text-[10px] text-[var(--warn)]">chưa lưu</span>
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
 * Dòng TRỐNG ở cuối mỗi cụm — gõ tên + số lượng rồi Enter là tạo dòng mới, và
 * dòng trống mới lại xuất hiện. Đây là vòng "tạo định mức trực tiếp trên bảng".
 */
export function PartRowNew({
  productId,
  groupCode,
  sectionTitle,
  unitBasis,
  clusterName,
  materialKind,
}: {
  productId: string
  groupCode: string
  sectionTitle: string | null
  unitBasis: string | null
  /** Cụm mà dòng mới rơi vào — dòng trống nằm ngay dưới cụm nào thì theo cụm đó. */
  clusterName: string | null
  materialKind: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [draft, setDraft] = useState<Draft>({
    ...EMPTY,
    cluster_name: clusterName ?? '',
  })
  const [busy, setBusy] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  const set = (k: InputKey, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const setMany = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const { body, preview } = usePreview(draft, materialKind, groupCode)
  const ready = !!body.part_name && !!body.qty && body.qty > 0

  async function create() {
    if (!ready || busy) return
    setBusy(true)
    try {
      const { _derived, ...rest } = body
      await api(`/api/dept/technical/products/${productId}/parts`, {
        method: 'POST',
        body: {
          ...rest,
          weight_kg: _derived.weight_kg,
          group_code: groupCode,
          section_title: sectionTitle,
          unit_basis: unitBasis,
        },
      })
      // Giữ lại cụm + ĐVT: gõ tiếp trong cùng cụm là việc thường, gõ lại mỗi dòng
      // thì mất hết cái lợi của lưới nhập liên tục.
      setDraft({ ...EMPTY, cluster_name: draft.cluster_name, unit: draft.unit })
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
        cells={inputCellsFor(groupCode)}
        draft={draft}
        set={set}
        setMany={setMany}
        onEnter={() => void create()}
        preview={preview}
        shapeOff={!!draft.profile_shape && !isCalculable(draft.profile_shape)}
        nameRef={nameRef}
      />
      <td className="py-0.5">
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
