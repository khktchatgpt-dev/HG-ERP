import { parseProductCode } from '@/lib/product-code'

/**
 * PHÂN NHÓM "PHẦN SẮT / PHẦN NHÔM" cho sổ tổng (GĐ1 — theo sổ Excel
 * "TỔNG TĐ SX": dòng nhóm merge chia đôi bảng). Không bắt thống kê khai thêm
 * gì — suy từ vật tư của chi tiết (loại/tên/mã đã join) rồi rơi về vật liệu
 * khung trong mã SP (CH0221HG-AL → nhôm).
 *
 * File thuần, không chạm DB — có test cạnh bên.
 */

export type MaterialSection = 'sat' | 'nhom' | 'inox' | 'khac'

export const SECTION_ORDER: MaterialSection[] = ['sat', 'nhom', 'inox', 'khac']

export const SECTION_LABELS: Record<MaterialSection, string> = {
  sat: 'PHẦN SẮT',
  nhom: 'PHẦN NHÔM',
  inox: 'PHẦN INOX',
  khac: 'PHẦN KHÁC',
}

/** Bỏ dấu + thường hoá để so khớp ("Nhôm" ~ "nhom", "Thép" ~ "thep"). */
function fold(s: string): string {
  // Dải combining diacritics viết bằng escape kẻo editor/formatter nuốt ký tự tổ hợp.
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

/**
 * Nhóm vật liệu của MỘT chi tiết từ thông tin vật tư; null = không đoán được.
 * Mã vật tư theo catalog kho: NH-… = nhôm, IX-… = inox (SA-/ST- không chắc
 * nên chỉ tin chữ).
 */
export function componentSection(c: {
  material_type: string | null
  material_name: string | null
  material_code: string | null
}): MaterialSection | null {
  const code = (c.material_code ?? '').toUpperCase()
  if (/^NH[-_0-9]/.test(code)) return 'nhom'
  if (/^IX[-_0-9]/.test(code)) return 'inox'
  const text = fold(`${c.material_type ?? ''} ${c.material_name ?? ''}`)
  if (!text.trim()) return null
  // Inox soi trước: "thép không gỉ"/"inox" chứa cả chữ "thep".
  if (/\binox\b|khong gi/.test(text)) return 'inox'
  if (/nhom|\balu(minium|minum)?\b/.test(text)) return 'nhom'
  if (/\bsat\b|\bthep\b|\bsteel\b/.test(text)) return 'sat'
  return null
}

/** Vật liệu khung trong mã SP → nhóm; mã cũ không parse được → 'khac'. */
export function productCodeSection(productCode: string): MaterialSection {
  const material = parseProductCode(productCode)?.material
  if (material === 'AL') return 'nhom'
  if (material === 'IR') return 'sat'
  if (material === 'IN') return 'inox'
  return 'khac'
}

/**
 * Nhóm của MỘT SP = đa số nhóm các chi tiết của nó (Excel xếp theo chi tiết
 * nhưng SP thực tế thuần một vật liệu khung); không chi tiết nào đoán được →
 * theo mã SP. Hoà nhau → theo mã SP nếu mã đoán ra một trong các nhóm hoà,
 * không thì lấy nhóm đứng trước theo SECTION_ORDER (sắt trước như sổ).
 */
export function productSection(
  productCode: string,
  components: {
    material_type: string | null
    material_name: string | null
    material_code: string | null
  }[],
): MaterialSection {
  const votes = new Map<MaterialSection, number>()
  for (const c of components) {
    const s = componentSection(c)
    if (s) votes.set(s, (votes.get(s) ?? 0) + 1)
  }
  if (votes.size === 0) return productCodeSection(productCode)
  const max = Math.max(...votes.values())
  const top = SECTION_ORDER.filter((s) => votes.get(s) === max)
  if (top.length === 1) return top[0]
  const byCode = productCodeSection(productCode)
  return top.includes(byCode) ? byCode : top[0]
}
