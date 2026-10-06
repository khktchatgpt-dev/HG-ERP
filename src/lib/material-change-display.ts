/**
 * Sổ vết vật tư (0177) ghi NGUYÊN VĂN giá trị cột — với `default_supplier_id`
 * đó là UUID, và hộp "Lịch sử" từng in thẳng `03375374-3786-…` (rà 06/10/2026,
 * nút "Đặt làm mặc định" ở Hồ sơ vật tư làm việc này thành chuyện hằng ngày).
 *
 * Dịch sang tên NCC lúc ĐỌC chứ không lúc ghi: NCC đổi tên thì sổ vẫn đúng tên
 * hiện hành, và các dòng vết cũ cũng được dịch luôn. NCC đã xoá (không còn tên)
 * thì giữ nguyên UUID — thà lộ mã máy còn hơn bày một ô trống như chưa từng đặt.
 */
export const SUPPLIER_ID_FIELDS: readonly string[] = ['default_supplier_id']

type Row = { field: string; before_value: string | null; after_value: string | null }

/** Các UUID NCC cần tra tên trong một loạt dòng vết. */
export function supplierIdsIn(rows: readonly Row[]): string[] {
  const ids = new Set<string>()
  for (const r of rows) {
    if (!SUPPLIER_ID_FIELDS.includes(r.field)) continue
    if (r.before_value) ids.add(r.before_value)
    if (r.after_value) ids.add(r.after_value)
  }
  return [...ids]
}

/** Thay UUID NCC bằng tên — dòng khác giữ nguyên. */
export function withSupplierNames<T extends Row>(
  rows: readonly T[],
  names: ReadonlyMap<string, string>,
): T[] {
  const name = (v: string | null) => (v ? (names.get(v) ?? v) : v)
  return rows.map((r) =>
    SUPPLIER_ID_FIELDS.includes(r.field)
      ? { ...r, before_value: name(r.before_value), after_value: name(r.after_value) }
      : r,
  )
}
