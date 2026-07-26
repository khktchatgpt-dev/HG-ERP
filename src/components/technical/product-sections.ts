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
  }
}

export type BomLineView = {
  material_code: string
  material_name: string
  material_unit: string
  qty_per_unit: number
  note: string | null
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
      { name: 'category', label: 'Danh mục', maxLength: 100 },
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
        name: 'set_contents',
        label: 'Bộ gồm',
        maxLength: 500,
        placeholder: '1 bàn + 6 ghế',
      },
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
      { name: 'showroom_sample', label: 'Có mẫu tại showroom', kind: 'checkbox' },
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
}

/**
 * Gợi ý mồi cho ô chưa có dữ liệu nào trong DB — để lần nhập đầu tiên cũng có
 * cái để chọn. Trộn với giá trị thật đã dùng ở SP khác (`suggestions` từ server).
 */
const SEED_SUGGEST: Record<string, string[]> = {
  unit: ['cai', 'bo', 'set', 'pcs'],
  pack_unit_label: ['ctn', 'pallet'],
}

/** Gắn `suggest` vào từng ô của một phần trước khi mở hộp thoại sửa. */
export function withSuggest(
  section: SectionSpec,
  suggestions: Record<string, string[]>,
): SectionSpec {
  return {
    ...section,
    fields: section.fields.map((f) => {
      if (f.kind === 'select' || f.kind === 'checkbox' || f.kind === 'number') return f
      const merged = [
        ...new Set([...(suggestions[f.name] ?? []), ...(SEED_SUGGEST[f.name] ?? [])]),
      ]
      return merged.length ? { ...f, suggest: merged } : f
    }),
  }
}

export const dim3 = (a?: number, b?: number, c?: number) =>
  a != null && b != null && c != null ? `${a} × ${b} × ${c} cm` : null

export const num = (n?: number | null, suffix = '') =>
  n != null ? `${n.toLocaleString('en-US')}${suffix}` : null

/** CBM một thùng carton — chỉ tính khi có đủ 3 chiều. */
export const cartonCbm = (pk: Packing) =>
  pk.carton_l_cm != null && pk.carton_w_cm != null && pk.carton_h_cm != null
    ? (pk.carton_l_cm * pk.carton_w_cm * pk.carton_h_cm) / 1_000_000
    : null
