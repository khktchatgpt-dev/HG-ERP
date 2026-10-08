/**
 * THƯ VIỆN SẢN PHẨM — dữ liệu cho màn danh sách `/products` (08/10/2026).
 *
 * Màn trả lời "SP nào chưa đủ hồ sơ để đưa vào lệnh / báo giá?" (khuôn C).
 * Một lượt `listPage` làm cả ba việc trên CÙNG MỘT tập cờ:
 *   1. chấm checklist 6 ô cho từng SP (`lib/ho-so-sp`);
 *   2. đếm cho các ô dữ kiện / chip — đếm trên tập đã áp các bộ lọc THUỘC TÍNH
 *      (trạng thái, khách, loại, khung), KHÔNG áp từ khoá: từ khoá tìm ở DB
 *      (cột `search_text`, có nhánh gần đúng) nên không tính lại ở app được;
 *   3. lấy đúng một trang dòng (DB phân trang), bù hàng món cho SP bộ.
 */

import type { User } from '@/modules/core/users/users.repo'
import { filesRepo } from '@/modules/core/files/files.repo'
import {
  bomRequiredFor,
  hoSoCheck,
  hoSoThieu,
  matchThieu,
  type HoSoCheck,
  type ThieuFilter,
} from '@/lib/ho-so-sp'
import { fileImageSrc } from '@/server/file-image'
import { libraryRepo, type LibFlagRow } from './library.repo'
import { NO_CUSTOMER_FILTER, productsRepo, type ProductLite } from './technical.repo'
import { productsService } from './technical.service'

export type LibraryFilters = {
  q?: string
  /** Nhãn khách, `NO_CUSTOMER_FILTER` = mẫu chung, '' = tất cả. */
  kh: string
  loai: string
  khung: string
  thieu: '' | ThieuFilter
  /** Thiếu kích thước SP (dài × rộng × cao). */
  kt: boolean
  tt: 'active' | 'inactive' | 'all'
  /** Đang nằm trên ≥1 lệnh SX chưa xong. */
  lenh: boolean
  /** Có hiện vật mẫu. */
  mau: boolean
  /** Chưa có giá kế hoạch — chỉ có nghĩa khi người xem được thấy giá. */
  gia: boolean
  page: number
  page_size: number
}

export type LibraryCounts = {
  total: number
  thieu: Record<ThieuFilter, number>
  kt: number
  lenh: number
  mau: number
  gia: number
  /** SP ngừng dùng trong tập khách/loại/khung đang lọc — số trên ô "Trạng thái". */
  ngung: number
}

export type LibraryChild = {
  id: string | null
  code: string | null
  name: string
  qty: number
  product_type: string | null
  frame_material: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  net_weight_kg: number | null
  check: HoSoCheck | null
  parts: number
  lsx_open: number
  image_url: string | null
}

export type LibraryRow = {
  id: string
  code: string
  name: string
  customer_name: string | null
  customer_item_code: string | null
  product_type: string | null
  frame_material: string | null
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  net_weight_kg: number | null
  gw_kg: number | null
  is_set: boolean
  is_active: boolean
  locked_at: string | null
  bom_status: 'none' | 'drawing' | 'done'
  parts: number
  check: HoSoCheck
  lsx_open: number
  lsx_total: number
  plan_price: number | null
  plan_currency: string | null
  image_url: string | null
  children: LibraryChild[]
}

type Flag = LibFlagRow & {
  check: HoSoCheck
  has_dims: boolean
  parts: number
  lsx_open: number
  lsx_total: number
  has_sample: boolean
}

async function loadFlags(): Promise<Map<string, Flag>> {
  const [rows, parts, packing, samples, lsx, docs] = await Promise.all([
    libraryRepo.flagRows(),
    libraryRepo.partsCountByProduct(),
    libraryRepo.packingByProduct(),
    libraryRepo.sampleProductIds(),
    libraryRepo.lsxByProduct(),
    filesRepo.productDocFlags(),
  ])
  const drawing = new Set(
    docs.filter((d) => d.doc_type === 'drawing').map((d) => d.product_id),
  )
  const out = new Map<string, Flag>()
  for (const r of rows) {
    const pk = packing.get(r.id)
    const n = parts.get(r.id) ?? 0
    const l = lsx.get(r.id)
    const loading = pk?.loading ?? (r.loading_40hc ? Number(r.loading_40hc) : null)
    out.set(r.id, {
      ...r,
      parts: n,
      has_dims: !!(r.length_mm && r.width_mm && r.height_mm),
      lsx_open: l?.open ?? 0,
      lsx_total: l?.total ?? 0,
      has_sample: samples.has(r.id),
      check: hoSoCheck({
        has_parts: n > 0,
        has_drawing: drawing.has(r.id),
        has_image: !!r.image_file_id,
        has_packing: !!pk || !!r.carton_l_cm,
        has_loading: !!loading && loading > 0,
        has_sample: samples.has(r.id),
        bom_required: bomRequiredFor(r.product_type),
      }),
    })
  }
  return out
}

function matchAttrs(f: Flag, o: LibraryFilters): boolean {
  if (o.tt === 'active' && !f.is_active) return false
  if (o.tt === 'inactive' && f.is_active) return false
  if (
    o.kh === NO_CUSTOMER_FILTER
      ? f.customer_name != null
      : o.kh && f.customer_name !== o.kh
  )
    return false
  if (o.loai && f.product_type !== o.loai) return false
  if (o.khung && f.frame_material !== o.khung) return false
  return true
}

function matchSets(f: Flag, o: LibraryFilters): boolean {
  if (o.thieu && !matchThieu(f.check, o.thieu)) return false
  if (o.kt && f.has_dims) return false
  if (o.lenh && f.lsx_open === 0) return false
  if (o.mau && !f.has_sample) return false
  if (o.gia && f.plan_price != null) return false
  return true
}

function toRow(
  p: ProductLite,
  f: Flag | undefined,
  children: LibraryChild[],
  canPrice: boolean,
): LibraryRow {
  const gw = (p.packing as { gw_kg?: number } | null)?.gw_kg
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    customer_name: p.customer_name,
    customer_item_code: p.customer_item_code,
    product_type: p.product_type,
    frame_material: p.frame_material,
    length_mm: p.length_mm,
    width_mm: p.width_mm,
    height_mm: p.height_mm,
    net_weight_kg: p.net_weight_kg,
    gw_kg: typeof gw === 'number' && gw > 0 ? gw : null,
    is_set: p.is_set,
    is_active: p.is_active,
    locked_at: p.locked_at,
    bom_status: p.bom_status,
    parts: f?.parts ?? 0,
    // Cờ đọc trước trang; SP vừa tạo giữa hai nhịp thì chấm như SP mới tinh.
    check:
      f?.check ??
      hoSoCheck({
        has_parts: false,
        has_drawing: false,
        has_image: !!p.image_file_id,
        has_packing: false,
        has_loading: false,
        has_sample: false,
        bom_required: bomRequiredFor(p.product_type),
      }),
    lsx_open: f?.lsx_open ?? 0,
    lsx_total: f?.lsx_total ?? 0,
    // Giá KH chỉ rời server khi người xem có quyền — không gửi rồi giấu ở client.
    plan_price: canPrice ? (f?.plan_price ?? null) : null,
    plan_currency: canPrice ? (f?.plan_currency ?? null) : null,
    image_url: p.image_file_id ? fileImageSrc(p.image_file_id) : null,
    children,
  }
}

export const libraryService = {
  async listPage(
    user: User,
    o: LibraryFilters,
    /** Người xem có `technical.plan_cost.view` — có thì dòng mang Giá KH. */
    canPrice: boolean,
  ): Promise<{
    rows: LibraryRow[]
    total: number
    fuzzy: boolean
    counts: LibraryCounts
    customers: { name: string; count: number }[]
  }> {
    const [flags, customers] = await Promise.all([
      loadFlags(),
      productsService.customerNames(),
    ])

    // ── đếm trên tập thuộc tính (không áp từ khoá) ──
    const base = [...flags.values()].filter((f) => matchAttrs(f, o))
    const counts: LibraryCounts = {
      total: base.length,
      thieu: { any: 0, bom: 0, bv: 0, anh: 0, dg: 0, xc: 0, mau: 0 },
      kt: 0,
      lenh: 0,
      mau: 0,
      gia: 0,
      ngung: [...flags.values()].filter((f) => matchAttrs(f, { ...o, tt: 'inactive' }))
        .length,
    }
    for (const f of base) {
      const th = hoSoThieu(f.check)
      if (th.length) counts.thieu.any++
      for (const k of th) counts.thieu[k]++
      if (!f.has_dims) counts.kt++
      if (f.lsx_open > 0) counts.lenh++
      if (f.has_sample) counts.mau++
      if (f.plan_price == null) counts.gia++
    }

    // ── lấy trang: lọc TẬP (thiếu/kt/lệnh/mẫu/giá) tính ở app → đưa id xuống DB ──
    const setFilterOn = !!o.thieu || o.kt || o.lenh || o.mau || o.gia
    const ids = setFilterOn
      ? base.filter((f) => matchSets(f, o)).map((f) => f.id)
      : undefined
    const page = await productsService.listLite(user, {
      q: o.q,
      customer_name: o.kh || undefined,
      product_type: o.loai || undefined,
      frame_material: o.khung || undefined,
      is_active: o.tt === 'active' ? true : o.tt === 'inactive' ? false : undefined,
      ids,
      page: o.page,
      page_size: o.page_size,
    })

    // ── món của SP bộ trên trang ──
    const setIds = page.rows.filter((p) => p.is_set).map((p) => p.id)
    const items = await libraryRepo.setItemsByProducts(setIds)
    const childIds = [
      ...new Set(items.map((i) => i.item_product_id).filter(Boolean)),
    ] as string[]
    const childLite = childIds.length ? await productsRepo.listLiteByIds(childIds) : []
    const childById = new Map(childLite.map((c) => [c.id, c]))
    const childrenOf = (setId: string): LibraryChild[] =>
      items
        .filter((i) => i.set_product_id === setId)
        .map((i) => {
          const c = i.item_product_id ? childById.get(i.item_product_id) : undefined
          const f = c ? flags.get(c.id) : undefined
          return {
            id: c?.id ?? null,
            code: c?.code ?? null,
            name: c?.name ?? i.item_label,
            qty: i.qty,
            product_type: c?.product_type ?? null,
            frame_material: c?.frame_material ?? null,
            length_mm: c?.length_mm ?? null,
            width_mm: c?.width_mm ?? null,
            height_mm: c?.height_mm ?? null,
            net_weight_kg: c?.net_weight_kg ?? null,
            check: f?.check ?? null,
            parts: f?.parts ?? 0,
            lsx_open: f?.lsx_open ?? 0,
            image_url: c?.image_file_id ? fileImageSrc(c.image_file_id) : null,
          }
        })

    return {
      rows: page.rows.map((p) =>
        toRow(p, flags.get(p.id), p.is_set ? childrenOf(p.id) : [], canPrice),
      ),
      total: page.total,
      fuzzy: page.fuzzy ?? false,
      counts,
      customers,
    }
  },
}
