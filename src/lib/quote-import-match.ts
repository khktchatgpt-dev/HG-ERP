import type { QuoteExcelRow } from './quote-excel'

/**
 * KHỚP DÒNG FILE VỚI THƯ VIỆN SẢN PHẨM — logic thuần, tách khỏi service để test
 * được mọi ca hiểm mà không cần DB.
 *
 * Ba ca từng làm hỏng dữ liệu nếu không chặn (đều đã thành test bên dưới):
 *
 *  1. TRÙNG NHIỀU SP: hai sản phẩm cùng `customer_item_code` (khách A và khách B
 *     đặt trùng mã). Bản đầu coi "không khớp được đúng một cái" = "hàng mới" nên
 *     ĐẺ THÊM bản thứ ba. Nay chặn lại, bắt người dùng điền mã nội bộ.
 *  2. SP ĐÃ NGỪNG DÙNG: tập khớp chỉ lấy SP đang hoạt động, nên file ghi mã của
 *     SP ngừng dùng sẽ đi tạo mới — mà `technical_products.code` là UNIQUE ⇒ vỡ
 *     ở tầng DB với lỗi thô. Nay khớp cả SP ngừng dùng và cảnh báo.
 *  3. TRÙNG DÒNG TRONG CHÍNH FILE: hai dòng cùng mã. `sales_quote_lines` KHÔNG
 *     có ràng buộc chống trùng, nên báo giá sẽ có hai dòng y hệt (hoặc vỡ UNIQUE
 *     nếu là hàng mới). Nay dòng sau bị chặn và chỉ rõ trùng với dòng nào.
 */

export type CatalogProduct = {
  id: string
  code: string
  name: string
  customer_item_code: string | null
  is_active: boolean
}

export type ResolvedRow = QuoteExcelRow & {
  action: 'existing' | 'new' | 'blocked'
  matched_product_id: string | null
  matched_label: string | null
  /** Khớp được nhiều SP — người dùng phải chỉ đích danh bằng mã nội bộ. */
  ambiguous: boolean
  has_image: boolean
  /** Vì sao bị chặn (chỉ có khi action = 'blocked'). */
  blocked_reason: string | null
}

/** Bỏ dấu + bỏ ký tự không phải chữ-số: "PT 138/155" ≡ "pt138155". */
export const keyOf = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

function indexBy(
  products: CatalogProduct[],
  pick: (p: CatalogProduct) => string | null,
): Map<string, CatalogProduct[]> {
  const m = new Map<string, CatalogProduct[]>()
  for (const p of products) {
    const raw = pick(p)
    if (!raw) continue
    const k = keyOf(raw)
    if (!k) continue
    const arr = m.get(k) ?? []
    arr.push(p)
    m.set(k, arr)
  }
  return m
}

export function resolveImportRows(
  rows: QuoteExcelRow[],
  catalog: CatalogProduct[],
): ResolvedRow[] {
  const byCode = indexBy(catalog, (p) => p.code)
  const byItem = indexBy(catalog, (p) => p.customer_item_code)
  const byName = indexBy(catalog, (p) => p.name)

  /** Đã dùng ở dòng nào — chặn trùng trong CÙNG file. */
  const seen = new Map<string, number>()

  return rows.map((r) => {
    const base = {
      ...r,
      matched_product_id: null as string | null,
      matched_label: null as string | null,
      ambiguous: false,
      has_image: r.image_id != null,
      blocked_reason: null as string | null,
    }

    if (r.missing.length > 0) {
      return {
        ...base,
        action: 'blocked' as const,
        blocked_reason: r.missing.join(' · '),
      }
    }

    // Thứ tự khớp: mã nội bộ → mã khách → tên. Mã nội bộ là UNIQUE nên chắc nhất.
    const hits =
      (r.code ? byCode.get(keyOf(r.code)) : undefined) ??
      (r.customer_item_code ? byItem.get(keyOf(r.customer_item_code)) : undefined) ??
      (r.name ? byName.get(keyOf(r.name)) : undefined) ??
      []

    if (hits.length > 1) {
      return {
        ...base,
        action: 'blocked' as const,
        ambiguous: true,
        blocked_reason: `khớp ${hits.length} sản phẩm trong thư viện (${hits
          .slice(0, 3)
          .map((h) => h.code)
          .join(', ')}) — điền Mã SP (HG) để chỉ đích danh`,
      }
    }

    const one = hits[0] ?? null

    /*
     * Khoá chống trùng trong file: SP đã khớp thì theo id; hàng mới thì theo mã
     * nội bộ người dùng khai, không có thì theo mã khách, cuối cùng mới tới tên.
     */
    const dupKey = one
      ? `id:${one.id}`
      : r.code
        ? `code:${keyOf(r.code)}`
        : r.customer_item_code
          ? `item:${keyOf(r.customer_item_code)}`
          : `name:${keyOf(r.name ?? '')}`

    const firstAt = seen.get(dupKey)
    if (firstAt != null) {
      return {
        ...base,
        action: 'blocked' as const,
        matched_product_id: one?.id ?? null,
        matched_label: one ? `${one.code} — ${one.name}` : null,
        blocked_reason: `trùng với dòng ${firstAt} trong file`,
      }
    }
    seen.set(dupKey, r.row)

    if (one) {
      const warnings = one.is_active
        ? r.warnings
        : [...r.warnings, `sản phẩm ${one.code} đang NGỪNG DÙNG trong thư viện`]
      return {
        ...base,
        warnings,
        action: 'existing' as const,
        matched_product_id: one.id,
        matched_label: `${one.code} — ${one.name}`,
      }
    }

    return { ...base, action: 'new' as const }
  })
}
