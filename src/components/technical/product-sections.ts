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
  /** CBM/thùng khai trực tiếp (m³) — khi chưa đo 3 chiều thùng (LSX ROSCO). */
  cbm?: number
}

export type TechSpec = {
  machine?: string
  cushion?: string
  paint?: string
  glass?: string
  wood?: string
  /* Mục 5 tài liệu (0146): vải, phụ kiện, màu hoàn thiện. Nằm trong jsonb
     `tech_spec` nên không tốn migration — đây là mô tả tự do, không phải số. */
  fabric?: string
  hardware?: string
  finish?: string
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
  thickness_mm: number | null
  actual_weight_kg: number | null
  bom_rev: number | null
  bom_effective_date: string | null
  bom_prepared_by: string | null
  bom_approved_by: string | null
  /** Người phụ trách hồ sơ (0144) — id; tên tra ở trang, xem `ownerOptions`. */
  owner_id: string | null
  /** Ngày tạo hồ sơ — chỉ đọc, không có ô sửa (mục A tài liệu). */
  created_at: string
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
    thickness_mm: p.thickness_mm,
    actual_weight_kg: p.actual_weight_kg,
    bom_rev: p.bom_rev,
    bom_effective_date: p.bom_effective_date,
    bom_prepared_by: p.bom_prepared_by,
    bom_approved_by: p.bom_approved_by,
    owner_id: p.owner_id,
    created_at: p.created_at,
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
      /* Khách/nhóm là NHÃN TỰ DO (0091) nhưng phải chọn được từ nhãn đã dùng —
         combo vừa tìm vừa cho gõ nhãn mới, thay ô text + datalist mà người dùng
         không biết là có danh sách. */
      {
        name: 'customer_name',
        label: 'Khách hàng / nhóm',
        kind: 'combo',
        createKind: 'customer',
        createLabel: 'Dùng nhãn mới',
        emptyLabel: '— mẫu chung —',
      },
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
      {
        name: 'category',
        label: 'Danh mục',
        kind: 'combo',
        createKind: 'category',
        createLabel: 'Tạo danh mục',
        emptyLabel: '— chưa phân loại —',
      },
      /*
       * NGƯỜI PHỤ TRÁCH (0144, mục A tài liệu) — chọn từ danh sách nhân sự, KHÔNG
       * gõ tay: hai ô gõ tay sẵn có (`bom_prepared_by` / `bom_approved_by` ở phần
       * Kiểm soát tài liệu) là chữ ký in lên biểu mẫu ISO, không tra ngược được
       * ra người còn làm việc. Options đổ vào lúc render (`ownerOptions`).
       */
      { name: 'owner_id', label: 'Người phụ trách', kind: 'combo' },
      /*
       * ĐVT bán PHẢI là select (13/08/2026). Hồi còn gõ tay, 737 SP đẻ ra SÁU
       * cách viết cho hai khái niệm: "cai" 684 · "cái" 45 · "bộ" 6 · "bo" 1 ·
       * "pcs" 1 · "set" 1. Mọi thứ đếm/gộp theo ĐVT vì thế đều lệch.
       * `unitOptions` giữ nguyên giá trị cũ của SP trong danh sách nên mở form
       * ra KHÔNG âm thầm đổi ĐVT của 684 SP đang ghi "cai".
       */
      { name: 'unit', label: 'ĐVT bán', kind: 'select', required: true },
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
  /*
   * KÍCH THƯỚC & KHỐI LƯỢNG CỦA SẢN PHẨM (mục 5 tài liệu) — gom về tab Thông số.
   *
   * Trước đây sáu ô mm này nằm trong phần "Đóng gói xuất khẩu" ở tab Đóng gói,
   * lẫn với số của THÙNG. User: "thông số kỹ thuật hiện tại tôi thấy tách ra,
   * nên gộp lại trong trang thông số kỹ thuật" — đúng: dài/rộng/cao/dày/khối
   * lượng là số của SẢN PHẨM, còn carton/xếp cont mới là đóng gói.
   *
   * Ô mm mở cho sửa tay vì 5 SP gập/mở có KTSP nhập nhằng, bộ trích từ file BOM
   * cố ý bỏ trống chờ người khai đúng (0104).
   */
  dims: {
    key: 'dims',
    title: 'Kích thước & khối lượng',
    hint: 'số của sản phẩm',
    fields: [
      { name: 'length_mm', label: 'Dài SP — gấp', kind: 'number', step: '1', unit: 'mm' },
      { name: 'width_mm', label: 'Rộng SP — gấp', kind: 'number', step: '1', unit: 'mm' },
      { name: 'height_mm', label: 'Cao SP — gấp', kind: 'number', step: '1', unit: 'mm' },
      {
        name: 'length_open_mm',
        label: 'Dài khi MỞ',
        kind: 'number',
        step: '1',
        unit: 'mm',
      },
      {
        name: 'width_open_mm',
        label: 'Rộng khi MỞ',
        kind: 'number',
        step: '1',
        unit: 'mm',
      },
      {
        name: 'height_open_mm',
        label: 'Cao khi MỞ',
        kind: 'number',
        step: '1',
        unit: 'mm',
      },
      // 0146 — độ dày mặt bàn / tấm / kính. KHÁC độ dày thành ống của dòng ĐM.
      { name: 'thickness_mm', label: 'Độ dày', kind: 'number', step: '0.1', unit: 'mm' },
      {
        name: 'net_weight_kg',
        label: 'Khối lượng tịnh',
        kind: 'number',
        step: '0.001',
        unit: 'kg',
      },
      {
        name: 'actual_weight_kg',
        label: 'KL cân thực tế',
        kind: 'number',
        step: '0.001',
        unit: 'kg',
      },
    ],
  },
  packing: {
    key: 'packing',
    title: 'Đóng gói xuất khẩu',
    hint: 'in báo giá / xếp cont',
    fields: [
      {
        name: 'qty_per_carton',
        label: 'SP / thùng',
        kind: 'number',
        step: '1',
        json: 'packing',
        unit: 'SP',
      },
      {
        name: 'carton_l_cm',
        label: 'Carton dài',
        kind: 'number',
        step: '0.1',
        json: 'packing',
        unit: 'cm',
      },
      {
        name: 'carton_w_cm',
        label: 'Carton rộng',
        kind: 'number',
        step: '0.1',
        json: 'packing',
        unit: 'cm',
      },
      {
        name: 'carton_h_cm',
        label: 'Carton cao',
        kind: 'number',
        step: '0.1',
        json: 'packing',
        unit: 'cm',
      },
      {
        name: 'loading_40hc',
        label: "Loading 40'HC",
        kind: 'number',
        step: '1',
        json: 'packing',
        unit: 'thùng',
      },
      {
        name: 'nw_kg',
        label: 'NW / thùng',
        kind: 'number',
        step: '0.01',
        json: 'packing',
        unit: 'kg',
      },
      {
        name: 'gw_kg',
        label: 'GW / thùng',
        kind: 'number',
        step: '0.01',
        json: 'packing',
        unit: 'kg',
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
        label: 'Tải trọng tối đa',
        kind: 'number',
        step: '0.1',
        unit: 'kg',
      },
      // `material` chuyển sang phần "Vật liệu & màu", `net_weight_kg` sang phần
      // "Kích thước & khối lượng" (0146): mỗi ô chỉ được sửa ở MỘT chỗ, nếu
      // không hai form cùng trang ghi đè lẫn nhau.
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
      // Đi liền ô "Bộ gồm" — bật cờ mà bỏ trắng nội dung thì đóng gói không biết
      // phải chia mấy kiện.
      { name: 'is_set', label: 'Là bộ nhiều món', kind: 'checkbox' },
    ],
  },
  /*
   * VẬT LIỆU & MÀU (mục 5 tài liệu) — gom đúng danh sách tài liệu liệt kê: gỗ,
   * kim loại, sơn, vải, kính, phụ kiện, màu hoàn thiện.
   *
   * Trước đây mấy ô này nằm rải: `material` ở thẻ "Đặc tính sản phẩm", còn
   * gỗ/sơn/kính/nệm ở thẻ "Thông số sản xuất" — cùng một câu hỏi "SP làm bằng
   * gì" mà phải mở hai thẻ. LOẠI KIM LOẠI không có ô riêng: nó suy từ mã SP
   * (`frame_material`), tab Thông số hiện chỉ-đọc cạnh các ô này.
   */
  materials: {
    key: 'materials',
    title: 'Vật liệu & màu',
    hint: 'catalogue / LSX',
    fields: [
      { name: 'material', label: 'Chất liệu chính', maxLength: 200 },
      { name: 'wood', label: 'Loại gỗ', maxLength: 200, json: 'tech_spec' },
      { name: 'paint', label: 'Sơn (mã màu)', maxLength: 200, json: 'tech_spec' },
      { name: 'fabric', label: 'Vải', maxLength: 200, json: 'tech_spec' },
      { name: 'glass', label: 'Kính', maxLength: 200, json: 'tech_spec' },
      { name: 'cushion', label: 'Nệm / mút', maxLength: 200, json: 'tech_spec' },
      {
        name: 'hardware',
        label: 'Phụ kiện (ngũ kim)',
        maxLength: 200,
        json: 'tech_spec',
      },
      {
        name: 'finish',
        label: 'Màu hoàn thiện (finish)',
        maxLength: 200,
        json: 'tech_spec',
        placeholder: 'Natural Oak / Walnut / Black',
        wide: true,
      },
      // Cờ bật/tắt đặt CẠNH ô mô tả tương ứng (Nệm ↔ có nệm, Kính ↔ có kính):
      // hai thứ luôn phải khớp, để xa nhau thì sửa một mà quên cái kia.
      { name: 'is_upholstered', label: 'Có nệm / bọc (qua tổ may)', kind: 'checkbox' },
      { name: 'has_glass', label: 'Có kính', kind: 'checkbox' },
    ],
  },
  techSpec: {
    key: 'techSpec',
    title: 'Thông số sản xuất',
    hint: 'in trên LSX',
    fields: [
      { name: 'machine', label: 'Máy', maxLength: 200, json: 'tech_spec' },
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
  // Đóng gói nay nằm ngay tab Hồ sơ (13/08/2026) — không còn tab riêng.
  packing: '',
  dims: 'thong-so',
  materials: 'thong-so',
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
      if (f.kind === 'select' || f.kind === 'combo') {
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

/**
 * Options cho ô "Người phụ trách" (0144). Người đang giữ hồ sơ mà đã nghỉ việc
 * (không còn trong danh sách) vẫn được thêm vào cuối, kèm dấu — nếu không thì
 * mở form sửa là ô nhảy về trống và lưu lại sẽ xoá mất người phụ trách.
 */
/**
 * ĐVT bán — danh sách ngắn, cố định. Giá trị SP đang mang mà nằm ngoài danh
 * sách thì THÊM VÀO ĐẦU chứ không bỏ: mở form sửa tên SP không được phép âm
 * thầm đổi luôn đơn vị bán của hồ sơ.
 */
export function unitOptions(current: string | null): { value: string; label: string }[] {
  const base = ['cái', 'bộ', 'set', 'pcs']
  const opts = base.map((u) => ({ value: u, label: u }))
  if (current && !base.includes(current)) {
    opts.unshift({ value: current, label: `${current} (đang dùng)` })
  }
  return opts
}

export function ownerOptions(
  users: { id: string; name: string }[],
  current: string | null,
): { value: string; label: string }[] {
  const opts = [
    { value: '', label: '— chưa giao —' },
    ...users.map((u) => ({ value: u.id, label: u.name })),
  ]
  if (current && !users.some((u) => u.id === current)) {
    opts.push({ value: current, label: 'Người cũ (đã khoá / xoá)' })
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
 * Kích thước tổng thể SP — MỘT nguồn duy nhất: ba cột mm, theo quy ước bảng kê
 * quy cách của công ty `(L/D x W x H) mm`.
 *
 * Trước 0129 có thêm bộ `packing.l_cm…` gõ tay và hàm này ưu tiên bản gõ tay.
 * Hoá ra đó chính là chỗ sinh lệch: 3/4 SP có cả hai thì số khác nhau, và bản
 * gõ tay là bản sai (đối chiếu bảng kê gốc của CH0065HG-AL). Bộ cm đã bị xoá,
 * chỗ nào cần cm thì tự quy đổi khi hiển thị (`@/lib/packing-dims`).
 */
export function productDims(
  p: Pick<ProductView, 'length_mm' | 'width_mm' | 'height_mm'>,
): { text: string; unit: string } | null {
  if (p.length_mm != null && p.width_mm != null && p.height_mm != null)
    return { text: `${p.length_mm} × ${p.width_mm} × ${p.height_mm}`, unit: 'mm' }
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

/**
 * CBM một thùng carton — ưu tiên TÍNH từ 3 chiều (số đo là nguồn mạnh nhất);
 * chưa đo thùng thì lấy số khai trực tiếp `cbm` (LSX ROSCO chốt sẵn CBM/SP).
 */
export const cartonCbm = (pk: Packing) =>
  pk.carton_l_cm != null && pk.carton_w_cm != null && pk.carton_h_cm != null
    ? (pk.carton_l_cm * pk.carton_w_cm * pk.carton_h_cm) / 1_000_000
    : (pk.cbm ?? null)

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
