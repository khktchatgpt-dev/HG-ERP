import { db } from '@/server/db'
import { isPoTemplate, type PoTemplate } from '@/lib/po-template'

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
  /*
   * grades/finishes theo NHÓM, cùng nguồn "lấy từ chính dữ liệu" như nhóm phụ
   * (02/09 — "không nên để nhập tay, nên là chọn"): ô Vật liệu/màu và Màu/bề
   * mặt trước đây là input trần, mỗi người gõ một kiểu ("xi trắng"/"Xi trắng"/
   * "xi trang") và đơn in ra ba nhãn cho cùng một thứ. Chọn từ nhãn ĐÃ DÙNG
   * trong nhóm là đường mặc định; gõ mới vẫn được vì màu/bề mặt là từ vựng mở.
   */
  groups: {
    name: string
    subs: string[]
    grades: string[]
    finishes: string[]
    /** Mẫu đơn mua mặc định cho vật tư mới của nhóm (0183) — null = chưa đặt. */
    po_template: PoTemplate | null
  }[]
  /** Nhãn bao gói đã dùng toàn danh mục (bì/bó/thùng/bao…) — không theo nhóm. */
  packUnits: string[]
}

/**
 * Cache trong process, 5 phút.
 *
 * Nhóm phụ phải quét cả danh mục 13k dòng vì PostgREST không có DISTINCT. Form
 * mở vài chục lần một ngày; quét lại mỗi lần là tiền egress thuần tuý. Vật tư
 * mới tạo có thể chậm hiện nhóm phụ tối đa 5 phút — nhóm phụ của nó thì người
 * vừa gõ đã biết rồi.
 */
/*
 * MỒI cho danh sách bao gói: đo 02/09 cả 13k vật tư lẫn 90 dòng đơn đều chưa
 * ghi pack_unit nào — danh sách chọn khởi đầu rỗng thì ô "chọn thay vì gõ"
 * thành ô gõ trần có vỏ mới. Từ vựng bao gói là tập ĐÓNG (khác màu/vật liệu)
 * nên mồi cứng trong code là đúng chỗ; nhãn đã dùng trong DB vẫn được gộp thêm.
 */
const PACK_UNIT_SEED = ['bì', 'bó', 'bao', 'thùng', 'cuộn', 'hộp', 'gói', 'cây']

let cache: { at: number; data: MaterialTaxonomy } | null = null
const TTL_MS = 5 * 60_000

export async function materialTaxonomy(): Promise<MaterialTaxonomy> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data

  const { data: items } = await db()
    .from('catalog_items')
    .select('type, label, sort_order, meta')
    .in('type', ['unit', 'material_group'])
    .eq('is_active', true)
    .order('sort_order')

  const rows =
    (items as
      | { type: string; label: string; meta: { po_template?: string | null } | null }[]
      | null) ?? []
  const units = rows.filter((r) => r.type === 'unit').map((r) => r.label)
  const groupRows = rows.filter((r) => r.type === 'material_group')
  const groupNames = groupRows.map((r) => r.label)
  // Mẫu đơn mặc định theo nhóm (0183) — chỉ nhận giá trị hợp lệ, meta là jsonb tự do.
  const groupTemplate = new Map<string, PoTemplate | null>(
    groupRows.map((r) => {
      const t = r.meta?.po_template
      return [r.label, isPoTemplate(t) ? t : null]
    }),
  )

  // Quét cả bảng — PostgREST chặn cứng 1000 dòng/request, `.limit()` lớn hơn vẫn
  // chỉ trả 1000 và KHÔNG báo lỗi.
  const bySub = new Map<string, Set<string>>()
  const byGrade = new Map<string, Set<string>>()
  const byFinish = new Map<string, Set<string>>()
  const packUnits = new Set<string>()
  const put = (m: Map<string, Set<string>>, k: string, v: string | null) => {
    if (!v) return
    const set = m.get(k) ?? new Set<string>()
    set.add(v)
    m.set(k, set)
  }
  type Row = {
    group_name: string | null
    sub_group: string | null
    material_grade: string | null
    finish: string | null
    pack_unit: string | null
  }
  for (let from = 0; from < 60_000; from += 1000) {
    const { data, error } = await db()
      .from('warehouse_materials')
      .select('group_name, sub_group, material_grade, finish, pack_unit')
      .eq('is_active', true)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = (data as Row[]) ?? []
    for (const r of page) {
      if (r.pack_unit) packUnits.add(r.pack_unit)
      if (!r.group_name) continue
      put(bySub, r.group_name, r.sub_group)
      put(byGrade, r.group_name, r.material_grade)
      put(byFinish, r.group_name, r.finish)
    }
    if (page.length < 1000) break
  }

  /*
   * GỘP THÊM NHÃN TỪ DÒNG ĐƠN ĐẶT: cột grade/finish của danh mục mới có từ
   * 0124/0137 nên gần rỗng (đo 02/09: 4 nhãn / 13k vật tư), trong khi người
   * soạn đơn đã gõ 18 nhãn thật trên dòng đơn (mã màu sơn NCC, FSC…). Không
   * gộp thì ô chọn không có gì để chọn — và người ta lại gõ tay tiếp.
   * Nhóm suy qua embed vật tư của dòng; dòng tự do (material null) bỏ qua.
   */
  type PoRow = {
    material_grade: string | null
    finish: string | null
    pack_unit: string | null
    material: { group_name: string | null } | { group_name: string | null }[] | null
  }
  for (let from = 0; from < 60_000; from += 1000) {
    const { data, error } = await db()
      .from('supply_purchase_order_lines')
      .select(
        'material_grade, finish, pack_unit, material:warehouse_materials(group_name)',
      )
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    const page = (data as PoRow[]) ?? []
    for (const r of page) {
      if (r.pack_unit) packUnits.add(r.pack_unit.trim())
      const m = Array.isArray(r.material) ? r.material[0] : r.material
      if (!m?.group_name) continue
      put(byGrade, m.group_name, r.material_grade?.trim() || null)
      put(byFinish, m.group_name, r.finish?.trim() || null)
    }
    if (page.length < 1000) break
  }
  for (const u of PACK_UNIT_SEED) packUnits.add(u)

  // Nhóm có trong danh mục nhưng chưa có vật tư nào vẫn phải hiện — không thì
  // không ai khai được vật tư đầu tiên cho nhóm đó.
  //
  // CHỈ nhóm trong danh mục (Đợt 4, 03/09/2026). Trước đây gộp thêm mọi
  // `group_name` lạ đang có trên vật tư, nên một mã gõ lệch nhóm là dropdown
  // của cả app mọc thêm một "nhóm" không ai tạo. Nay vật tư mang nhóm lạ chỉ
  // đơn giản là không thuộc nhóm nào — và API tạo/sửa đã chặn ghi nhóm lạ
  // (`groupGateError`), nên trường hợp đó chỉ còn ở dữ liệu cũ.
  const names = groupNames
  const data: MaterialTaxonomy = {
    units,
    groups: names.map((name) => {
      const viSort = (set?: Set<string>) =>
        [...(set ?? [])].sort((a, b) => a.localeCompare(b, 'vi'))
      return {
        name,
        subs: viSort(bySub.get(name)),
        grades: viSort(byGrade.get(name)),
        finishes: viSort(byFinish.get(name)),
        po_template: groupTemplate.get(name) ?? null,
      }
    }),
    packUnits: [...packUnits].sort((a, b) => a.localeCompare(b, 'vi')),
  }
  cache = { at: Date.now(), data }
  return data
}

/** Gọi sau khi thêm vật tư có nhóm phụ mới, để form kế tiếp thấy ngay. */
export function invalidateTaxonomy(): void {
  cache = null
}
