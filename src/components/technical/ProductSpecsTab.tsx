'use client'

import { Globe2, Ship } from 'lucide-react'
import { SpecSection } from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import { num, type ProductView } from '@/components/technical/product-sections'

/** Tab THÔNG SỐ — đặc tính SP (catalogue/báo giá) + thông số in trên LSX. */
export function ProductSpecsTab({
  product,
  suggestions,
  canEdit,
}: {
  product: ProductView
  suggestions: Record<string, string[]>
  canEdit: boolean
}) {
  const { editHandler, node } = useSectionEditor(product, suggestions, canEdit)
  const ts = product.tech_spec ?? {}

  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SpecSection
          icon={Globe2}
          title="Đặc tính sản phẩm"
          hint="catalogue / báo giá"
          fields={[
            ['Chất liệu chính', product.material],
            ['Tải trọng tối đa', num(product.max_load_kg, ' kg')],
            [
              'Lắp ráp',
              product.assembly === 'kd'
                ? 'Tháo rời (KD)'
                : product.assembly === 'assembled'
                  ? 'Nguyên chiếc'
                  : null,
            ],
            ['Bộ gồm', product.set_contents],
          ]}
          onEdit={editHandler('export')}
          editing={node('export')}
        />

        <SpecSection
          icon={Ship}
          title="Thông số sản xuất"
          hint="in trên LSX"
          fields={[
            ['Máy', ts.machine],
            ['Nệm', ts.cushion],
            ['Sơn', ts.paint],
            ['Kính', ts.glass],
            ['Gỗ', ts.wood],
            ['Mẫu showroom', product.showroom_sample ? 'Có' : 'Không'],
          ]}
          onEdit={editHandler('techSpec')}
          editing={node('techSpec')}
        />
      </div>
    </div>
  )
}
