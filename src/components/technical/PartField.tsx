'use client'

import { DiePicker } from '@/components/supply/DiePicker'
import { SHAPE_OPTIONS, pcsPerBarFrom } from '@/lib/bom-calc'
import type { InputCell, InputKey } from './part-layouts'

/**
 * MỘT Ô NHẬP của dòng định mức — mọi chỗ nhập (lưới "Gõ nhiều dòng", dòng sửa
 * tại chỗ, dòng thêm mới) đều đọc CÙNG một định nghĩa ô ở đây; chép lại là hai
 * đường lệch nhau ngay lần sửa đầu (ô chọn vật tư kéo theo ĐVT ở bên này mà bên
 * kia không).
 *
 * (Thẻ sửa chia vùng `PartCardEdit` đã BỎ 21/08/2026 — user chọn sửa trực tiếp
 * trên dòng; các vùng `zonesFor` gỡ cùng đợt.)
 */

export type PartDraft = Record<InputKey, string>

export const nOrNull = (v: string): number | null => {
  const t = v.trim().replace(',', '.')
  if (!t) return null
  const x = Number(t)
  return Number.isFinite(x) ? x : null
}

/** Số khúc trên cây suy từ chiều dài — hiện làm gợi ý mờ trong ô, không ép. */
export const autoPcsOf = (d: PartDraft): number | null =>
  pcsPerBarFrom(
    nOrNull(d.cut_length_mm),
    nOrNull(d.bend_waste_mm),
    nOrNull(d.bar_length_m),
  )

/** Chọn khuôn thì kéo theo kg/m — tiết diện có gân không suy từ hình học được. */
export function diePatch(
  d: PartDraft,
  die: { code: string; weight_per_m: number | null },
): Partial<PartDraft> {
  return {
    profile_code: die.code,
    kg_per_m: die.weight_per_m != null ? String(die.weight_per_m) : d.kg_per_m,
  }
}

export function PartField({
  cell,
  draft,
  set,
  setMany,
  onEnter,
  className,
  inputRef,
}: {
  cell: InputCell
  draft: PartDraft
  set: (k: InputKey, v: string) => void
  /** Chọn từ danh mục điền một lúc nhiều ô — phải gộp vào MỘT lần setState. */
  setMany: (patch: Partial<PartDraft>) => void
  onEnter?: () => void
  className: string
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onEnter) {
      e.preventDefault()
      onEnter()
    }
  }
  const autoPcs = autoPcsOf(draft)

  if (cell.kind === 'die') {
    return (
      <DiePicker
        value={draft.profile_code}
        ariaLabel={cell.label}
        onPick={(d) => setMany(diePatch(draft, d))}
        onTextChange={(code) => set('profile_code', code)}
        // Ăn theo kiểu ô của nơi gọi — lưới truyền ô bảng tính, thẻ truyền ô form.
        inputClassName={`${className} font-mono`}
        placeholder={cell.placeholder ?? null}
      />
    )
  }

  if (cell.kind === 'shape') {
    return (
      <select
        value={draft.profile_shape}
        onChange={(e) => set('profile_shape', e.target.value)}
        className={className}
        aria-label={cell.label}
      >
        <option value="">—</option>
        {SHAPE_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    )
  }

  const suggestsPcs = cell.key === 'pcs_per_bar' && autoPcs != null
  return (
    <input
      ref={inputRef}
      value={draft[cell.key]}
      onChange={(e) => set(cell.key, e.target.value)}
      onKeyDown={onKey}
      inputMode={cell.kind === 'num' ? 'decimal' : undefined}
      // Ô Cụm gợi ý các cụm đã có của sản phẩm; gõ tên mới thì tạo cụm.
      list={cell.kind === 'cluster' ? 'cluster-names' : undefined}
      // Ô suy được thì để TRỐNG và hiện số suy ra làm gợi ý — gõ đè khi thực tế
      // khác (xưởng chừa hao nhiều hơn lý thuyết).
      title={suggestsPcs ? `Suy từ chiều dài: ${autoPcs} khúc / cây` : undefined}
      placeholder={suggestsPcs ? String(autoPcs) : cell.placeholder}
      className={className}
      aria-label={cell.label}
    />
  )
}
