'use client'

import { Factory, ShieldCheck, Tags } from 'lucide-react'
import { SpecSection } from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import { dec, num, type ProductView } from '@/components/technical/product-sections'

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
          icon={Tags}
          tone="violet"
          title="Đặc tính sản phẩm"
          hint="catalogue / báo giá"
          fields={[
            ['Chất liệu chính', product.material],
            [
              'Khối lượng tịnh',
              dec(product.net_weight_kg, 3) && `${dec(product.net_weight_kg, 3)} kg`,
            ],
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
            ['Là bộ nhiều món', product.is_set ? 'Có' : 'Không'],
          ]}
          onEdit={editHandler('export')}
          editing={node('export')}
        />

        <SpecSection
          icon={Factory}
          tone="emerald"
          title="Thông số sản xuất"
          hint="in trên LSX"
          fields={[
            ['Máy', ts.machine],
            ['Nệm', ts.cushion],
            ['Sơn', ts.paint],
            ['Kính', ts.glass],
            ['Gỗ', ts.wood],
            ['Có nệm / bọc', product.is_upholstered ? 'Có' : 'Không'],
            ['Có kính', product.has_glass ? 'Có' : 'Không'],
            ['Mẫu showroom', product.showroom_sample ? 'Có' : 'Không'],
          ]}
          onEdit={editHandler('techSpec')}
          editing={node('techSpec')}
        />
      </div>

      {/*
       * Khối ISO nằm dưới, chiếm trọn hàng: chỉ 2/537 SP có số, nhưng phải LUÔN
       * hiện thì mới có lối điền lần đầu — thẻ ẩn khi rỗng là thẻ không ai mở
       * được. Bản chỉ-đọc ở tab Hồ sơ vẫn ẩn khi trống.
       */}
      <SpecSection
        icon={ShieldCheck}
        tone="slate"
        title="Kiểm soát tài liệu BOM"
        hint="HG-QT-07/M02"
        fields={[
          [
            'Lần sửa đổi (Rev.)',
            product.bom_rev != null ? String(product.bom_rev) : null,
          ],
          [
            'Ngày hiệu lực',
            product.bom_effective_date
              ? new Date(product.bom_effective_date).toLocaleDateString('vi-VN')
              : null,
          ],
          ['Người lập', product.bom_prepared_by],
          ['Người duyệt', product.bom_approved_by],
        ]}
        onEdit={editHandler('docControl')}
        editing={node('docControl')}
      />
    </div>
  )
}
