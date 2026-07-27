/**
 * Dựng các dòng định mức khi CHÉP từ sản phẩm khác.
 *
 * Tách riêng khỏi repo để test được mà không cần Supabase: phần dễ sai ở đây là
 * quên bỏ id/product_id cũ (chép xong sửa dòng mới lại đụng dòng gốc) và đánh
 * lại sort_order (chép kiểu 'append' mà giữ số cũ thì thứ tự trộn lẫn).
 */

/**
 * Các cột được chép. `id`, `product_id`, `created_at`… CỐ Ý không nằm ở đây.
 *
 * `cluster_id` cũng KHÔNG nằm ở đây: cụm là bản ghi của riêng SP nguồn, chép
 * thẳng khoá sang thì dòng của SP đích trỏ vào cụm của SP khác. Cụm được dựng
 * lại bên đích qua `clusterMap` (xem tham số `opts.clusterMap`).
 */
export const COPIED_PART_FIELDS = [
  'group_code',
  'section_title',
  'unit_basis',
  'material_note',
  'tenon',
  'tenon_mm',
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
  'bend_waste_mm',
  'kg_per_m',
  'qty',
  'unit',
  'color',
  'weight_kg',
  'total_length_m',
  'paint_area_m2',
  'paint_area_box_m2',
  'volume_m3',
  'note',
] as const

export type CopyablePart = Record<string, unknown> & { group_code?: string | null }

export function buildCopiedParts(
  source: CopyablePart[],
  opts: {
    productId: string
    startOrder?: number
    groups?: string[]
    /** cluster_id của SP nguồn → cluster_id tương ứng vừa tạo bên SP đích. */
    clusterMap?: Map<string, string>
  },
): Record<string, unknown>[] {
  const wanted = opts.groups?.length ? new Set(opts.groups) : null
  const rows = wanted
    ? source.filter((p) => wanted.has(String(p.group_code ?? '')))
    : source.slice()

  let order = opts.startOrder ?? 1
  return rows.map((p) => {
    const out: Record<string, unknown> = { product_id: opts.productId }
    for (const f of COPIED_PART_FIELDS) if (f in p) out[f] = p[f]
    // Không map được (chép lẻ một nhóm mà cụm không kèm) → dòng về RỜI, chứ
    // không giữ khoá cũ trỏ sang SP nguồn.
    const src = p.cluster_id == null ? null : String(p.cluster_id)
    out.cluster_id = src ? (opts.clusterMap?.get(src) ?? null) : null
    out.sort_order = order++
    return out
  })
}
