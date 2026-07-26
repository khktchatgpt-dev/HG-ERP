/**
 * Dựng các dòng định mức khi CHÉP từ sản phẩm khác.
 *
 * Tách riêng khỏi repo để test được mà không cần Supabase: phần dễ sai ở đây là
 * quên bỏ id/product_id cũ (chép xong sửa dòng mới lại đụng dòng gốc) và đánh
 * lại sort_order (chép kiểu 'append' mà giữ số cũ thì thứ tự trộn lẫn).
 */

/** Các cột được chép. `id`, `product_id`, `created_at`… CỐ Ý không nằm ở đây. */
export const COPIED_PART_FIELDS = [
  'group_code',
  'section_title',
  'unit_basis',
  'material_note',
  'tenon',
  'set_item_label',
  'part_no',
  'part_name',
  'material_code',
  'material_kind',
  'profile_shape',
  'profile_code',
  'dim_a_mm',
  'dim_b_mm',
  'wall_thickness_mm',
  'cut_length_mm',
  'qty',
  'unit',
  'waste_pct',
  'weight_kg',
  'total_length_m',
  'paint_area_m2',
  'note',
] as const

export type CopyablePart = Record<string, unknown> & { group_code?: string | null }

export function buildCopiedParts(
  source: CopyablePart[],
  opts: { productId: string; startOrder?: number; groups?: string[] },
): Record<string, unknown>[] {
  const wanted = opts.groups?.length ? new Set(opts.groups) : null
  const rows = wanted
    ? source.filter((p) => wanted.has(String(p.group_code ?? '')))
    : source.slice()

  let order = opts.startOrder ?? 1
  return rows.map((p) => {
    const out: Record<string, unknown> = { product_id: opts.productId }
    for (const f of COPIED_PART_FIELDS) if (f in p) out[f] = p[f]
    out.sort_order = order++
    return out
  })
}
