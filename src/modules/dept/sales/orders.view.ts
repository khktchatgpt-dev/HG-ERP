import type {
  Product,
  ProductPacking,
  ProductPickRow,
} from '@/modules/dept/technical/technical.repo'

const mmToCm = (mm: number | null): number | undefined =>
  mm != null ? Math.round((mm / 10) * 100) / 100 : undefined

/** SP như ô chọn của form báo giá/đơn cần — khớp `ProductPick` phía client. */
export type QuotePickPayload = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  description_en: string | null
  has_image: boolean
  packing: ProductPacking
}

/**
 * Một dòng SP cho ô chọn của báo giá/đơn.
 *
 * BÙ KÍCH THƯỚC TỪ CỘT mm: dài×rộng×cao của SP nằm ở HAI nơi — `packing.l_cm…`
 * (cm, người gõ tay, 11/537 SP có) và `length_mm…` (mm, import BOM ghi, 292/537
 * SP có). Form báo giá trước chỉ đọc `packing` nên 290 SP hiện "— thiếu" dù số đã
 * có sẵn trong hồ sơ, và tờ báo giá in ra trống chỗ kích thước.
 *
 * Số gõ tay luôn thắng (giống `productDims` ở hồ sơ SP). Giá trị bù chỉ để HIỆN /
 * IN — không ghi ngược vào `packing`.
 */
export function toQuotePickPayload(p: ProductPickRow): QuotePickPayload {
  const pk = p.packing ?? {}
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    unit: p.unit,
    customer_id: p.customer_id,
    customer_item_code: p.customer_item_code,
    bom_status: p.bom_status,
    description_en: p.description_en,
    has_image: !!p.image_file_id,
    packing: {
      ...pk,
      l_cm: pk.l_cm ?? mmToCm(p.length_mm),
      w_cm: pk.w_cm ?? mmToCm(p.width_mm),
      h_cm: pk.h_cm ?? mmToCm(p.height_mm),
    },
  }
}

/** Dữ liệu SP rút gọn cho picker báo giá/đơn (kèm thông số tóm tắt để hiển thị). */
export type ProductPickData = {
  id: string
  code: string
  name: string
  unit: string
  customer_id: string | null
  customer_item_code: string | null
  bom_status: 'none' | 'drawing' | 'done'
  dims: string | null
  spec: string | null
  has_image: boolean
  // Quy cách đầy đủ + mô tả EN — báo giá hiện đủ như tờ Quotation thật.
  description_en: string | null
  packing: ProductPacking
}

export function toProductPick(p: Product): ProductPickData {
  const pk = p.packing ?? {}
  const dims =
    pk.l_cm != null && pk.w_cm != null && pk.h_cm != null
      ? `${pk.l_cm}×${pk.w_cm}×${pk.h_cm} cm`
      : null
  const ts = p.tech_spec ?? {}
  const specParts = [
    ts.paint && `Sơn: ${ts.paint}`,
    ts.wood && `Gỗ: ${ts.wood}`,
    ts.glass && `Kính: ${ts.glass}`,
  ].filter(Boolean) as string[]
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    unit: p.unit,
    customer_id: p.customer_id,
    customer_item_code: p.customer_item_code,
    bom_status: p.bom_status,
    dims,
    spec: specParts.length ? specParts.join(' · ') : null,
    has_image: !!p.image_file_id,
    description_en: p.description_en,
    packing: pk,
  }
}
