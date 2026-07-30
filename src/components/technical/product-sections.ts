import type { Product } from '@/modules/dept/technical/technical.repo'
import type { SectionSpec } from '@/components/technical/ProductSectionForm'

/**
 * Khai báo dùng CHUNG cho 4 tab hồ sơ sản phẩm (Hồ sơ / Đóng gói / Thông số /
 * Tài liệu): kiểu dữ liệu view, các phần sửa được và vài helper format.
 *
 * KHÔNG import gì từ `@/server` hay `db()` — file này chạy cả ở client.
 */

export type Packing = {
  l_cm?: number
  w_cm?: number
  h_cm?: number
  carton_l_cm?: number
  carton_w_cm?: number
  carton_h_cm?: number
  qty_per_carton?: number
  loading_40hc?: number
  pack_unit_label?: string
  nw_kg?: number
  gw_kg?: number
}

export type TechSpec = {
  machine?: string
  cushion?: string
  paint?: string
  glass?: string
  wood?: string
}

export type BomStatus = 'none' | 'drawing' | 'done'

export const BOM_LABEL: Record<BomStatus, string> = {
  none: 'Chưa có BOM',
  drawing: 'Đang vẽ',
  done: 'Đã vẽ',
}

export type ProductView = {
  id: string
  code: string
  name: string
  category: string | null
  customer_name: string | null
  customer_item_code: string | null
  description_en: string | null
  unit: string
  bom_status: BomStatus
  packing: Packing
  image_file_id: string | null
  notes: string | null
  name_foreign: string | null
  shipping_mark: string | null
  barcode: string | null
  showroom_sample: boolean
  reference_price: number | null
  tech_spec: TechSpec
  hs_code: string | null
  origin_country: string | null
  material: string | null
  max_load_kg: number | null
  assembly: 'assembled' | 'kd' | null
  set_contents: string | null
  is_active: boolean
  // ── Số tổng hợp từ file BOM (0092) ──
  product_type: string | null
  frame_material: string | null
  code_legacy: string | null
  is_upholstered: boolean
  has_glass: boolean
  is_set: boolean
  net_weight_kg: number | null
  frame_weight_kg: number | null
  frame_length_m: number | null
  paint_area_m2: number | null
  part_count: number | null
  /** mm — KHÁC `packing.l_cm` (cm, nhập tay). Xem `productDims`. */
  length_mm: number | null
  width_mm: number | null
  height_mm: number | null
  length_open_mm: number | null
  width_open_mm: number | null
  height_open_mm: number | null
  bom_rev: number | null
  bom_effective_date: string | null
  bom_prepared_by: string | null
  bom_approved_by: string | null
}

/** Cắt hàng SP từ repo xuống đúng những gì các tab cần (dùng ở cả 4 page). */
export function toProductView(p: Product): ProductView {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    category: p.category,
    customer_name: p.customer_name,
    customer_item_code: p.customer_item_code,
    description_en: p.description_en,
    unit: p.unit,
    bom_status: p.bom_status,
    packing: p.packing ?? {},
    image_file_id: p.image_file_id,
    notes: p.notes,
    name_foreign: p.name_foreign,
    shipping_mark: p.shipping_mark,
    barcode: p.barcode,
    showroom_sample: p.showroom_sample,
    reference_price: p.reference_price,
    tech_spec: p.tech_spec ?? {},
    hs_code: p.hs_code,
    origin_country: p.origin_country,
    material: p.material,
    max_load_kg: p.max_load_kg,
    assembly: p.assembly,
    set_contents: p.set_contents,
    is_active: p.is_active,
    product_type: p.product_type,
    frame_material: p.frame_material,
    code_legacy: p.code_legacy,
    is_upholstered: p.is_upholstered,
    has_glass: p.has_glass,
    is_set: p.is_set,
    net_weight_kg: p.net_weight_kg,
    frame_weight_kg: p.frame_weight_kg,
    frame_length_m: p.frame_length_m,
    paint_area_m2: p.paint_area_m2,
    part_count: p.part_count,
    length_mm: p.length_mm,
    length_open_mm: p.length_open_mm,
    width_open_mm: p.width_open_mm,
    height_open_mm: p.height_open_mm,
    width_mm: p.width_mm,
    height_mm: p.height_mm,
    bom_rev: p.bom_rev,
    bom_effective_date: p.bom_effective_date,
    bom_prepared_by: p.bom_prepared_by,
    bom_approved_by: p.bom_approved_by,
  }
}

/**
 * Hồ sơ chia thành từng phần sửa riêng, thay vì mở một form dài sửa tất cả.
 * Mỗi phần PATCH đúng các trường của nó (`productUpdateSchema` là partial).
 */
export const SECTIONS: Record<string, SectionSpec> = {
  identity: {
    key: 'identity',
    title: 'Nhận diện',
    fields: [
      { name: 'code', label: 'Mã nội bộ', mono: true, maxLength: 100, required: true },
      { name: 'name', label: 'Tên SP (tiếng Việt)', maxLength: 200, required: true },
      {
        name: 'name_foreign',
        label: 'Tên theo khách (in LSX)',
        maxLength: 300,
        wide: true,
      },
      { name: 'customer_name', label: 'Khách hàng / nhóm', maxLength: 200 },
      { name: 'customer_item_code', label: 'Mã KH đặt', mono: true, maxLength: 100 },
      {
        name: 'code_legacy',
        label: 'Mã cũ',
        mono: true,
        maxLength: 100,
        placeholder: 'S0031HG-AL',
      },
      /*
       * Danh mục = nhóm hàng do DN tự định nghĩa, quản lý ở /admin/catalogs
       * (`catalog_items` loại `product_category`). Options đổ vào lúc render
       * (`withSuggest`), không hằng hoá ở đây.
       *
       * PHẢI là select: hồi còn là ô gõ tự do thì 528/537 SP để trống và 9 SP có
       * giá trị đều là TÊN KHÁCH (BUNNING, MERXX, YOTRIO…) — tên khách thuộc ô
       * "Khách hàng / nhóm" ngay phía trên. Loại SP (Bàn/Ghế/…) là chuyện khác
       * nữa: nó suy từ mã SP, không nhập ở đây.
       */
      { name: 'category', label: 'Danh mục', kind: 'select' },
      { name: 'unit', label: 'ĐVT bán', maxLength: 30, required: true },
      { name: 'barcode', label: 'Barcode', mono: true, maxLength: 50 },
      { name: 'reference_price', label: 'Giá tham khảo', kind: 'number', step: '0.01' },
      {
        name: 'bom_status',
        label: 'Trạng thái BOM',
        kind: 'select',
        options: [
          { value: 'none', label: 'Chưa có BOM' },
          { value: 'drawing', label: 'Đang vẽ' },
          { value: 'done', label: 'Đã vẽ' },
        ],
      },
    ],
  },
  packing: {
    key: 'packing',
    title: 'Đóng gói xuất khẩu',
    hint: 'in báo giá / xếp cont',
    fields: [
      // Kích thước mm (từ file BOM) — mở cho sửa tay vì 5 SP gập/mở có KTSP
      // nhập nhằng, bộ trích cố ý bỏ trống chờ người khai đúng (0104).
      {
        name: 'length_mm',
        label: 'Dài SP (mm) — gấp',
        kind: 'number',
        step: '1',
      },
      { name: 'width_mm', label: 'Rộng SP (mm) — gấp', kind: 'number', step: '1' },
      { name: 'height_mm', label: 'Cao SP (mm) — gấp', kind: 'number', step: '1' },
      {
        name: 'length_open_mm',
        label: 'Dài khi MỞ (mm)',
        kind: 'number',
        step: '1',
      },
      { name: 'width_open_mm', label: 'Rộng khi MỞ (mm)', kind: 'number', step: '1' },
      { name: 'height_open_mm', label: 'Cao khi MỞ (mm)', kind: 'number', step: '1' },
      {
        name: 'l_cm',
        label: 'Dài SP (cm)',
        kind: 'number',
        step: '0.1',
        json: 'packing',
      },
      {
        name: 'w_cm',
        label: 'Rộng SP (cm)',
        kind: 'number',
        step: '0.1',
        json: 'packing',
      },
      {
        name: 'h_cm',
        label: 'Cao SP (cm)',
        kind: 'number',
        step: '0.1',
        json: 'packing',
      },
      {
        name: 'qty_per_carton',
        label: 'SP / thùng',
        kind: 'number',
        step: '1',
        json: 'packing',
      },
      {
        name: 'carton_l_cm',
        label: 'Carton dài (cm)',
        kind: 'number',
        step: '0.1',
        json: 'packing',
      },
      {
        name: 'carton_w_cm',
        label: 'Carton rộng (cm)',
        kind: 'number',
        step: '0.1',
        json: 'packing',
      },
      {
        name: 'carton_h_cm',
        label: 'Carton cao (cm)',
        kind: 'number',
        step: '0.1',
        json: 'packing',
      },
      {
        name: 'loading_40hc',
        label: "Loading 40'HC",
        kind: 'number',
        step: '1',
        json: 'packing',
      },
      {
        name: 'nw_kg',
        label: 'NW / thùng (kg)',
        kind: 'number',
        step: '0.01',
        json: 'packing',
      },
      {
        name: 'gw_kg',
        label: 'GW / thùng (kg)',
        kind: 'number',
        step: '0.01',
        json: 'packing',
      },
      {
        name: 'pack_unit_label',
        label: 'Đơn vị đóng gói',
        maxLength: 30,
        placeholder: 'ctn / pallet',
        json: 'packing',
      },
    ],
  },
  export: {
    key: 'export',
    title: 'Đặc tính sản phẩm',
    hint: 'catalogue / báo giá',
    // Mã HS và Xuất xứ đã bỏ khỏi hồ sơ (user chốt 26/07/2026): file BOM không
    // có nguồn, mà điền sai thì sai tờ khai hải quan. Cột vẫn còn trong DB nên
    // bật lại chỉ là thêm 2 dòng, không mất dữ liệu.
    fields: [
      {
        name: 'max_load_kg',
        label: 'Tải trọng tối đa (kg)',
        kind: 'number',
        step: '0.1',
      },
      { name: 'material', label: 'Chất liệu chính', maxLength: 300, wide: true },
      {
        name: 'assembly',
        label: 'Lắp ráp',
        kind: 'select',
        options: [
          { value: '', label: '—' },
          { value: 'assembled', label: 'Nguyên chiếc' },
          { value: 'kd', label: 'Tháo rời (KD)' },
        ],
      },
      {
        name: 'net_weight_kg',
        label: 'Khối lượng tịnh (kg)',
        kind: 'number',
        step: '0.001',
      },
      {
        name: 'set_contents',
        label: 'Bộ gồm',
        maxLength: 500,
        placeholder: '1 bàn + 6 ghế',
      },
      // Đi liền ô "Bộ gồm" — bật cờ mà bỏ trắng nội dung thì đóng gói không biết
      // phải chia mấy kiện.
      { name: 'is_set', label: 'Là bộ nhiều món', kind: 'checkbox' },
    ],
  },
  techSpec: {
    key: 'techSpec',
    title: 'Thông số sản xuất',
    hint: 'in trên LSX',
    fields: [
      { name: 'machine', label: 'Máy', maxLength: 200, json: 'tech_spec' },
      { name: 'cushion', label: 'Nệm', maxLength: 200, json: 'tech_spec' },
      { name: 'paint', label: 'Sơn (mã màu)', maxLength: 200, json: 'tech_spec' },
      { name: 'glass', label: 'Kính', maxLength: 200, json: 'tech_spec' },
      { name: 'wood', label: 'Gỗ', maxLength: 200, json: 'tech_spec' },
      // Cờ bật/tắt đặt CẠNH ô mô tả tương ứng (Nệm ↔ có nệm, Kính ↔ có kính):
      // hai thứ luôn phải khớp, để xa nhau thì sửa một mà quên cái kia.
      { name: 'is_upholstered', label: 'Có nệm / bọc (qua tổ may)', kind: 'checkbox' },
      { name: 'has_glass', label: 'Có kính', kind: 'checkbox' },
      { name: 'showroom_sample', label: 'Có mẫu tại showroom', kind: 'checkbox' },
    ],
  },
  /**
   * Khối kiểm soát tài liệu ISO (HG-QT-07/M02) của bảng định mức. Tách riêng
   * khỏi "Thông số sản xuất" vì đây là chữ ký/phiên bản chứng từ, không phải
   * thông số làm hàng — và chỉ người duyệt BOM mới đụng tới.
   */
  docControl: {
    key: 'docControl',
    title: 'Kiểm soát tài liệu BOM',
    hint: 'HG-QT-07/M02',
    fields: [
      { name: 'bom_rev', label: 'Lần sửa đổi (Rev.)', kind: 'number', step: '1' },
      { name: 'bom_effective_date', label: 'Ngày hiệu lực', kind: 'date' },
      { name: 'bom_prepared_by', label: 'Người lập', maxLength: 200 },
      { name: 'bom_approved_by', label: 'Người duyệt', maxLength: 200 },
    ],
  },
  text: {
    key: 'text',
    title: 'Mô tả & ghi chú',
    fields: [
      {
        name: 'description_en',
        label: 'Mô tả tiếng Anh (in báo giá)',
        kind: 'textarea',
        rows: 3,
        maxLength: 2000,
        wide: true,
      },
      {
        name: 'shipping_mark',
        label: 'Nội dung shipping mark',
        kind: 'textarea',
        rows: 3,
        maxLength: 2000,
        wide: true,
      },
      {
        name: 'notes',
        label: 'Ghi chú nội bộ',
        kind: 'textarea',
        rows: 3,
        maxLength: 2000,
        wide: true,
      },
    ],
  },
}

/** Phần hồ sơ nằm ở tab nào — '' là tab Hồ sơ (route gốc của SP). */
export const SECTION_TAB: Record<string, string> = {
  identity: '',
  text: '',
  packing: 'dong-goi',
  export: 'thong-so',
  techSpec: 'thong-so',
  docControl: 'thong-so',
}

/**
 * Gợi ý mồi cho ô chưa có dữ liệu nào trong DB — để lần nhập đầu tiên cũng có
 * cái để chọn. Trộn với giá trị thật đã dùng ở SP khác (`suggestions` từ server).
 */
const SEED_SUGGEST: Record<string, string[]> = {
  unit: ['cai', 'bo', 'set', 'pcs'],
  pack_unit_label: ['ctn', 'pallet'],
}

/**
 * Gắn `suggest` (datalist) và `options` (select) vào từng ô của một phần trước khi
 * mở form sửa.
 *
 * `dynamicOptions` dành cho select mà danh sách nằm trong DB chứ không hằng hoá
 * được — hiện là `category` (danh mục SP quản lý ở /admin/catalogs). Ô select đã
 * khai `options` sẵn (vd bom_status) thì giữ nguyên.
 */
export function withSuggest(
  section: SectionSpec,
  suggestions: Record<string, string[]>,
  dynamicOptions: Record<string, { value: string; label: string }[]> = {},
): SectionSpec {
  return {
    ...section,
    fields: section.fields.map((f) => {
      if (f.kind === 'select') {
        const dyn = dynamicOptions[f.name]
        return dyn && !f.options ? { ...f, options: dyn } : f
      }
      if (f.kind === 'checkbox' || f.kind === 'number') return f
      const merged = [
        ...new Set([...(suggestions[f.name] ?? []), ...(SEED_SUGGEST[f.name] ?? [])]),
      ]
      return merged.length ? { ...f, suggest: merged } : f
    }),
  }
}

/**
 * Options cho ô "Danh mục": ô trống + danh mục đang hiệu lực.
 *
 * `current` (giá trị SP đang lưu) được thêm vào nếu không có trong danh mục — nếu
 * không, mở form sửa rồi lưu là ÂM THẦM XOÁ mất giá trị cũ. Đúng cảnh 9 SP đang
 * mang tên khách ở ô này.
 */
export function categoryOptions(
  categories: { code: string; label: string }[],
  current: string | null,
): { value: string; label: string }[] {
  const opts = [
    {
      value: '',
      label: categories.length ? '— chưa phân loại —' : '— chưa có danh mục —',
    },
    ...categories.map((c) => ({ value: c.code, label: c.label })),
  ]
  if (current && !categories.some((c) => c.code === current)) {
    opts.push({ value: current, label: `${current} (ngoài danh mục)` })
  }
  return opts
}

export const dim3 = (a?: number, b?: number, c?: number) =>
  a != null && b != null && c != null ? `${a} × ${b} × ${c} cm` : null

export const num = (n?: number | null, suffix = '') =>
  n != null ? `${n.toLocaleString('en-US')}${suffix}` : null

/** Số có phần thập phân cố định — cho các đại lượng tính toán (kg, m, m²). */
export const dec = (n: number | null | undefined, d: number) =>
  n == null
    ? null
    : n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

/**
 * Kích thước tổng thể SP. HAI nguồn cùng mô tả một thứ, khác đơn vị:
 * `length_mm…` do import BOM ghi (mm, 292/537 SP có) và `packing.l_cm` do người
 * dùng gõ tay (cm, 12/537 SP có). Ưu tiên bản gõ tay — người đã sửa thì đó là
 * số đúng — rồi mới tới bản import, thay vì bỏ trắng như trước.
 */
export function productDims(
  p: Pick<ProductView, 'length_mm' | 'width_mm' | 'height_mm'>,
  pk: Packing,
): { text: string; unit: string; source: 'manual' | 'bom' } | null {
  if (pk.l_cm != null && pk.w_cm != null && pk.h_cm != null)
    return {
      text: `${pk.l_cm} × ${pk.w_cm} × ${pk.h_cm}`,
      unit: 'cm',
      source: 'manual',
    }
  if (p.length_mm != null && p.width_mm != null && p.height_mm != null)
    return {
      text: `${p.length_mm} × ${p.width_mm} × ${p.height_mm}`,
      unit: 'mm',
      source: 'bom',
    }
  return null
}

/**
 * Kích thước ở trạng thái MỞ / KÉO GIÃN — chỉ SP gập/mở mới có (0104).
 *
 * Chỉ chiều nào ĐỔI mới khai `*_open_mm`; chiều giữ nguyên để null và lấy lại số
 * của trạng thái đóng, để dòng in ra vẫn đủ ba chiều. Trả null khi SP không
 * gập/mở — tuyệt đại đa số thư viện.
 */
export function productDimsOpen(
  p: Pick<
    ProductView,
    | 'length_mm'
    | 'width_mm'
    | 'height_mm'
    | 'length_open_mm'
    | 'width_open_mm'
    | 'height_open_mm'
  >,
): { text: string; unit: string } | null {
  const l = p.length_open_mm ?? p.length_mm
  const w = p.width_open_mm ?? p.width_mm
  const h = p.height_open_mm ?? p.height_mm
  const hasOpen =
    p.length_open_mm != null || p.width_open_mm != null || p.height_open_mm != null
  if (!hasOpen || l == null || w == null || h == null) return null
  return { text: `${l} × ${w} × ${h}`, unit: 'mm' }
}

/** CBM một thùng carton — chỉ tính khi có đủ 3 chiều. */
export const cartonCbm = (pk: Packing) =>
  pk.carton_l_cm != null && pk.carton_w_cm != null && pk.carton_h_cm != null
    ? (pk.carton_l_cm * pk.carton_w_cm * pk.carton_h_cm) / 1_000_000
    : null

const mmToCm = (mm: number | null | undefined): number | undefined =>
  mm != null ? Math.round((mm / 10) * 100) / 100 : undefined

/** Phần phương án đóng gói cần cho `withPackingFallback` — khớp cấu trúc với
 *  `PackingOptionView` (ProductProfileCards.tsx), không import chéo file đó. */
type PackingOptionForFallback = {
  is_default: boolean
  loading_40hc: number | null
  packages: {
    carton_l_mm: number | null
    carton_w_mm: number | null
    carton_h_mm: number | null
    net_weight_kg?: number | null
    gross_weight_kg: number | null
  }[]
}

/**
 * Vá lỗ hổng "đã nhập nhưng không hiện": nhiều SP có phương án đóng gói / kiện
 * thật (import từ file BOM) nhưng ô tóm tắt `packing` (jsonb, nhập tay riêng)
 * vẫn trống → băng "Quy cách xuất khẩu" hiện toàn "—" dù dữ liệu đã có sẵn
 * ngay trong hồ sơ (phát hiện qua đối chiếu DB: ~160/537 SP rơi vào cảnh này).
 *
 * Giá trị NHẬP TAY luôn thắng (không bao giờ bị ghi đè). Chỉ bù khi trống:
 *   - Loading 40'HC: lấy thẳng từ phương án mặc định — không phụ thuộc số kiện.
 *   - Carton / NW / GW: CHỈ bù khi phương án có ĐÚNG 1 kiện — nhiều kiện thì
 *     kích thước/khối lượng không gộp về 1 con số được, để trống mới là đúng.
 */
export function withPackingFallback(
  pk: Packing,
  options: PackingOptionForFallback[],
): Packing {
  if (options.length === 0) return pk
  const opt = options.find((o) => o.is_default) ?? options[0]
  const single = opt.packages.length === 1 ? opt.packages[0] : null
  return {
    ...pk,
    loading_40hc: pk.loading_40hc ?? opt.loading_40hc ?? undefined,
    carton_l_cm: pk.carton_l_cm ?? mmToCm(single?.carton_l_mm),
    carton_w_cm: pk.carton_w_cm ?? mmToCm(single?.carton_w_mm),
    carton_h_cm: pk.carton_h_cm ?? mmToCm(single?.carton_h_mm),
    gw_kg: pk.gw_kg ?? single?.gross_weight_kg ?? undefined,
    nw_kg: pk.nw_kg ?? single?.net_weight_kg ?? undefined,
  }
}
