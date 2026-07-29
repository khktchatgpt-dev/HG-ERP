/**
 * Kiểu + hằng dùng chung cho màn Thư viện sản phẩm.
 *
 * File thuần, KHÔNG có JSX và KHÔNG import component — mọi mảnh khác của thư
 * mục `_components` đều kéo từ đây nên nó phải nằm ở đáy chuỗi phụ thuộc.
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

/** Thông số sản xuất (jsonb tech_spec) — in trên LSX. */
export type TechSpec = {
  machine?: string
  cushion?: string
  paint?: string
  glass?: string
  wood?: string
}

export type BomStatus = 'none' | 'drawing' | 'done'

export type Product = {
  id: string
  code: string
  name: string
  category: string | null
  /** Loại SP (2 ký tự — 'CH', 'TB'…) và vật liệu khung ('AL', 'IR'…). */
  product_type: string | null
  frame_material: string | null
  /** Nhãn khách/nhóm gõ tự do (0091) — null = mẫu chung. */
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
  // Thông tin XK + đặc tính nội thất (0037).
  hs_code: string | null
  origin_country: string | null
  material: string | null
  max_load_kg: number | null
  assembly: 'assembled' | 'kd' | null
  set_contents: string | null
  is_active: boolean
}

/**
 * Dòng nhẹ cho thư viện (thẻ/bảng) — chỉ trường cần; full nạp khi mở form sửa.
 * `has_drawing` / `has_bom` suy từ FILE đã upload (doc_type), không phải link cũ.
 */
export type ProductRow = Pick<
  Product,
  | 'id'
  | 'code'
  | 'name'
  | 'category'
  | 'product_type'
  | 'frame_material'
  | 'customer_name'
  | 'customer_item_code'
  | 'unit'
  | 'bom_status'
  | 'packing'
  | 'image_file_id'
  | 'is_active'
> & {
  has_drawing: boolean
  has_bom: boolean
  /**
   * Số xếp cont 40HC đã gộp nguồn ở server: phương án đóng gói thật
   * (technical_packing_options) trước, jsonb `packing` chỉ để bù chỗ trống.
   */
  loading_40hc: number | null
}

export type ProductCounts = {
  total: number
  active: number
  bom_none: number
  bom_drawing: number
  bom_done: number
  no_image: number
}

export type Filters = {
  q: string
  customer: string
  bom: string
  status: string
  /** 'missing' | 'has' | 'all' — lọc theo có ảnh đại diện hay chưa. */
  image: string
  /** Mã loại SP 2 ký tự ('CH', 'TB'…) hoặc 'all'. Server đã kiểm mã hợp lệ. */
  type: string
}

/** Bộ lọc bật/tắt được bằng chip — bấm lại giá trị đang bật thì bỏ lọc đó. */
export type ToggleFilterKey = 'bom' | 'status' | 'image'

/** Nhãn khách/nhóm đã dùng + số SP — đổ vào dropdown lọc & ô gợi ý. */
export type CustomerNameOption = { name: string; count: number }
export type MaterialOption = { id: string; code: string; name: string; unit: string }

/** SP tối thiểu để mở BOM editor (nhận cả ProductRow lẫn Product đầy đủ). */
export type BomTarget = Pick<Product, 'id' | 'code' | 'name' | 'bom_status'>

/** Dòng BOM đang biên tập (id chỉ có với dòng đã lưu). */
export type BomRow = { material_id: string; qty_per_unit: number | ''; note: string }

/** Giá trị lọc "chưa gõ nhãn khách" — PHẢI khớp NO_CUSTOMER_FILTER ở technical.repo.ts. */
export const NO_CUSTOMER = '__common'

export const VIEW_STORAGE_KEY = 'tech-products-view'

export const BOM_LABEL: Record<BomStatus, string> = {
  none: 'Chưa có BOM',
  drawing: 'Đang vẽ',
  done: 'Đã vẽ',
}

/** Badge định mức — dùng chung class với trang chi tiết ([id]/layout.tsx). */
export const BOM_BADGE: Record<BomStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  drawing: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
}

/**
 * Accent của workspace Kỹ thuật là `sky` (workspaces.config.ts) — sidebar, logo
 * box, highlight menu đều tô màu này. Trang phải dùng đúng nó cho MỌI thứ bấm
 * được (nút chính, chip đang bật, hover thẻ) thì mới liền một khối với shell.
 * Emerald/amber giữ riêng cho NGỮ NGHĨA tình trạng hồ sơ, không lẫn với accent.
 */
export const ACCENT_SOLID = 'bg-sky-600 text-white hover:bg-sky-700'

/** Nền chuyển sắc cho khung ảnh — dùng ở cả thẻ lưới lẫn hộp xem ảnh lớn. */
export const IMAGE_FRAME_BG =
  'bg-linear-to-b from-zinc-50 to-zinc-200/70 dark:from-zinc-900 dark:to-zinc-950'
