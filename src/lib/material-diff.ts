/**
 * SO HAI BẢN GHI VẬT TƯ → danh sách ô thật sự đổi, để ghi vết
 * (`warehouse_material_changes`, migration 0177).
 *
 * Vì sao thuần: đây là chỗ quyết định "có ghi vết hay không". Ghi thừa thì sổ
 * đầy dòng rác (`8` với `8.0`, `null` với `''` là CÙNG một giá trị dưới mắt
 * người dùng nhưng khác nhau trong JS); ghi thiếu thì mất đúng cái cần truy.
 * Nên nó có test riêng thay vì nằm lẫn trong service.
 */

/** Cột không bao giờ đáng ghi vết — máy tự đặt, không phải người sửa. */
const SKIP = new Set(['id', 'created_at', 'updated_at', 'created_by'])

/** Đưa mọi kiểu về một chuỗi để so — `null`/`''`/khoảng trắng là NHƯ NHAU. */
export function normValue(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (Array.isArray(v)) return v.length ? JSON.stringify(v) : null
  if (typeof v === 'object') return JSON.stringify(v)
  const t = String(v).trim()
  return t === '' ? null : t
}

/** Số thì so theo GIÁ TRỊ, không theo chữ: `8` = `8.0` = `' 8 '`. */
function same(a: string | null, b: string | null): boolean {
  if (a === b) return true
  if (a == null || b == null) return false
  const na = Number(a)
  const nb = Number(b)
  return Number.isFinite(na) && Number.isFinite(nb) && na === nb
}

export type MaterialChange = {
  field: string
  before: string | null
  after: string | null
}

/**
 * Chỉ soi những cột CÓ TRONG `patch` — patch một trường không được đẻ ra vết
 * cho cả bản ghi.
 */
export function diffMaterial(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): MaterialChange[] {
  const out: MaterialChange[] = []
  for (const [field, raw] of Object.entries(patch)) {
    if (SKIP.has(field)) continue
    if (raw === undefined) continue
    const b = normValue(before[field])
    const a = normValue(raw)
    if (same(b, a)) continue
    out.push({ field, before: b, after: a })
  }
  return out
}
