import type { Product, ProductPacking } from '@/modules/dept/technical/technical.repo'

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
