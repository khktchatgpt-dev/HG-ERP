'use client'

import { Globe2, ListTree, Ship } from 'lucide-react'
import { Card } from '@/components/shadcn/card'
import { Separator } from '@/components/shadcn/separator'
import { SpecSection } from '@/components/technical/ProductSpecCards'
import { useSectionEditor } from '@/components/technical/useSectionEditor'
import {
  num,
  type BomLineView,
  type ProductView,
} from '@/components/technical/product-sections'

/** Tab THÔNG SỐ — đặc tính SP (catalogue/báo giá) + thông số in trên LSX. */
export function ProductSpecsTab({
  product,
  bom,
  suggestions,
  canEdit,
}: {
  product: ProductView
  bom: BomLineView[]
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

      {/* BOM cũ gắn kho: chỉ HIỂN THỊ khi còn dữ liệu, không cho sửa ở đây nữa
          — tránh hai lối sửa định mức song song (tab Định mức là nguồn chuẩn). */}
      {bom.length > 0 && <BomCard bom={bom} />}
    </div>
  )
}

/**
 * BOM cũ gắn danh mục kho (bảng technical_bom_lines) — CHỈ ĐỌC.
 * Định mức thật của hồ sơ nằm ở tab Định mức; bảng này giữ lại vì phần cung ứng
 * còn dùng để tính nhu cầu mua, sẽ xử lý sau.
 */
function BomCard({ bom }: { bom: BomLineView[] }) {
  return (
    <Card className="gap-0 py-0">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <ListTree className="text-muted-foreground size-4" />
          <h2 className="text-sm font-semibold">BOM gắn kho (cũ)</h2>
          <span className="text-muted-foreground text-xs">
            · {bom.length} dòng · chỉ đọc
          </span>
        </div>
      </div>
      <Separator />
      <div className="overflow-x-auto px-5 py-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs uppercase">
              <th className="py-2 pr-3 font-medium">Vật tư</th>
              <th className="py-2 pr-3 text-right font-medium">Định mức / SP</th>
              <th className="py-2 font-medium">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {bom.map((l, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1.5 pr-3">
                  <span className="text-muted-foreground font-mono text-xs">
                    {l.material_code}
                  </span>{' '}
                  {l.material_name}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {l.qty_per_unit.toLocaleString('en-US')} {l.material_unit}
                </td>
                <td className="text-muted-foreground py-1.5">{l.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
