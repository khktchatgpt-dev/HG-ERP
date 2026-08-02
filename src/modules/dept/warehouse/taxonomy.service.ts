import { db } from '@/server/db'

/**
 * PHÂN LOẠI VẬT TƯ CHO FORM KHAI MỚI: ĐVT · nhóm · nhóm phụ.
 *
 * Hai nguồn khác nhau, cố ý:
 *   · ĐVT và NHÓM lấy từ `catalog_items` — danh sách CHỐT, quản trị viên sửa.
 *     Nhóm quyết định phạm vi so trùng tên lúc chặn tạo trùng, nên không để
 *     người dùng gõ tự do rồi đẻ nhóm thứ 15 ngay hôm sau.
 *   · NHÓM PHỤ lấy từ chính dữ liệu (`warehouse_materials.sub_group`) — 106 giá
 *     trị do phòng Cung ứng đặt và còn đẻ thêm. Bắt qua danh mục quản trị là
 *     mỗi lần thêm nhóm phụ phải nhờ admin.
 */
export type MaterialTaxonomy = {
  units: string[]
  groups: { name: string; subs: string[] }[]
}

/**
 * Cache trong process, 5 phút.
 *
 * Nhóm phụ phải quét cả danh mục 13k dòng vì PostgREST không có DISTINCT. Form
 * mở vài chục lần một ngày; quét lại mỗi lần là tiền egress thuần tuý. Vật tư
 * mới tạo có thể chậm hiện nhóm phụ tối đa 5 phút — nhóm phụ của nó thì người
 * vừa gõ đã biết rồi.
 */
let cache: { at: number; data: MaterialTaxonomy } | null = null
const TTL_MS = 5 * 60_000

export async function materialTaxonomy(): Promise<MaterialTaxonomy> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  const { data: items } = await db()
    .from('catalog_items')
    .select('type, label, sort_order')
    .in('type', ['unit', 'material_group'])
    .eq('is_active', true)
    .order('sort_order')

  const rows = (items as { type: string; label: string }[] | null) ?? []
  const units = rows.filter((r) => r.type === 'unit').map((r) => r.label)
  const groupNames = rows.filter((r) => r.type === 'material_group').map((r) => r.label)

  // Quét cả bảng — PostgREST chặn cứng 1000 dòng/request, `.limit()` lớn hơn vẫn
  // chỉ trả 1000 và KHÔNG báo lỗi.
  const bySub = new Map<string, Set<string>>()
  for (let from = 0; from < 60_000; from += 1000) {
    const { data, error } = await db()
      .from('warehouse_materials')
      .select('group_name, sub_group')
      .eq('is_active', true)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = (data as { group_name: string | null; sub_group: string | null }[]) ?? []
    for (const r of page) {
      if (!r.group_name || !r.sub_group) continue
      const set = bySub.get(r.group_name) ?? new Set<string>()
      set.add(r.sub_group)
      bySub.set(r.group_name, set)
    }
    if (page.length < 1000) break
  }

  // Nhóm có trong danh mục nhưng chưa có vật tư nào vẫn phải hiện — không thì
  // không ai khai được vật tư đầu tiên cho nhóm đó.
  const names = [...new Set([...groupNames, ...bySub.keys()])]
  const data: MaterialTaxonomy = {
    units,
    groups: names.map((name) => ({
      name,
      subs: [...(bySub.get(name) ?? [])].sort((a, b) => a.localeCompare(b, 'vi')),
    })),
  }
  cache = { at: Date.now(), data }
  return data
}

/** Gọi sau khi thêm vật tư có nhóm phụ mới, để form kế tiếp thấy ngay. */
export function invalidateTaxonomy(): void {
  cache = null
}
