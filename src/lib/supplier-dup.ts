import { supplierNameKey } from './supplier-code'

/**
 * CHỐNG TRÙNG NHÀ CUNG CẤP — thuần, dùng chung client (báo tại chỗ khi gõ) và
 * server (hàng rào cuối). 29/09/2026.
 *
 * Đo trên danh mục thật lúc dựng: 3 cặp NCC cùng MST, và CẢ BA đều là hai công
 * ty khác tên (Nhôm Việt Ý / Nhôm Hoàng Gia…) — tức một trong hai gõ SAI MST,
 * không phải trùng thật. Nên MST trùng thì CHẶN (bắt sửa tận gốc), còn tên trùng
 * chỉ CẢNH BÁO (chi nhánh, xưởng khác cùng tên vẫn là NCC riêng).
 */

/** MST dạng so được: bỏ khoảng trắng, chấm; giữ gạch nối của MST chi nhánh (0101234567-001). */
export function normTaxNo(v: string | null | undefined): string | null {
  const s = (v ?? '').replace(/[\s.]/g, '').toUpperCase()
  return s || null
}

type Ncc = { id: string; name: string; tax_no: string | null }

export function findSupplierDupes<T extends Ncc>(
  list: readonly T[],
  draft: { name: string; tax_no: string | null | undefined },
  exceptId?: string,
): { taxOwner: T | null; sameName: T[] } {
  const others = exceptId ? list.filter((r) => r.id !== exceptId) : list
  const tax = normTaxNo(draft.tax_no)
  const key = draft.name.trim() ? supplierNameKey(draft.name) : ''
  return {
    taxOwner: tax ? (others.find((r) => normTaxNo(r.tax_no) === tax) ?? null) : null,
    sameName: key ? others.filter((r) => supplierNameKey(r.name) === key) : [],
  }
}
