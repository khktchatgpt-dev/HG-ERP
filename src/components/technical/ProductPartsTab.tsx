'use client'

import {
  SetItemsCard,
  type PartGroupView,
  type PartView,
  type SetItemView,
} from '@/components/technical/ProductProfileCards'
import { ProductPartsCard } from '@/components/technical/ProductPartsCard'

/** Tab Định mức: bộ gồm những món nào, rồi định mức chi tiết của cả sản phẩm. */
export function ProductPartsTab({
  productId,
  parts,
  partGroups,
  setItems,
  canEdit,
}: {
  productId: string
  parts: PartView[]
  partGroups: PartGroupView[]
  setItems: SetItemView[]
  canEdit: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <SetItemsCard items={setItems} />
      <ProductPartsCard
        parts={parts}
        partGroups={partGroups}
        productId={productId}
        canEdit={canEdit}
      />
    </div>
  )
}
