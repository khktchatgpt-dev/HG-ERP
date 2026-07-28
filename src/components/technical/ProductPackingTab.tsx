'use client'

import { Package } from 'lucide-react'
import { SpecSection } from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import {
  PackingOptionsCard,
  type PackingOptionView,
} from '@/components/technical/ProductProfileCards'
import {
  cartonCbm,
  dim3,
  num,
  productDims,
  withPackingFallback,
  type ProductView,
} from '@/components/technical/product-sections'

/** Tab ĐÓNG GÓI — quy cách in báo giá / xếp cont + các phương án đóng gói. */
export function ProductPackingTab({
  product,
  packingOptions,
  suggestions,
  canEdit,
}: {
  product: ProductView
  packingOptions: PackingOptionView[]
  suggestions: Record<string, string[]>
  canEdit: boolean
}) {
  const { editHandler, node } = useSectionEditor(product, suggestions, canEdit)
  // Bù các ô còn trống bằng phương án đóng gói mặc định — cùng dữ liệu hiện
  // ở "Phương án đóng gói" bên dưới, tránh cảnh 2 khối cùng trang mâu thuẫn nhau.
  const pk = withPackingFallback(product.packing ?? {}, packingOptions)
  const cbm = cartonCbm(pk)
  // Cùng nguồn với băng trên tab Hồ sơ: chưa gõ tay thì lấy kích thước file BOM
  // ghi (mm), thay vì để trống trong khi hồ sơ bên cạnh lại hiện số.
  const dims = productDims(product, pk)

  return (
    <div className="flex flex-col gap-6 pb-6">
      <SpecSection
        icon={Package}
        tone="amber"
        title="Đóng gói xuất khẩu"
        hint="in báo giá / xếp cont"
        fields={[
          ['Kích thước SP', dims && `${dims.text} ${dims.unit}`],
          ['Carton', dim3(pk.carton_l_cm, pk.carton_w_cm, pk.carton_h_cm)],
          ['SP / thùng', num(pk.qty_per_carton)],
          ['Loading 40′HC', num(pk.loading_40hc)],
          ['NW / thùng', num(pk.nw_kg, ' kg')],
          ['GW / thùng', num(pk.gw_kg, ' kg')],
          ['CBM / thùng', cbm != null ? `${cbm.toFixed(3)} m³` : null],
          ['Đơn vị đóng gói', pk.pack_unit_label],
        ]}
        onEdit={editHandler('packing')}
        editing={node('packing')}
      />

      <PackingOptionsCard options={packingOptions} />

      {packingOptions.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Chưa có phương án đóng gói chi tiết (nhiều kiện / nhiều PA). Phần này nạp từ
          file BOM khi import.
        </p>
      )}
    </div>
  )
}
