'use client'

import {
  SetItemsCard,
  type ClusterView,
  type PartGroupView,
  type PartView,
  type SetItemView,
} from '@/components/technical/ProductProfileCards'
import { ProductPartsCard } from '@/components/technical/ProductPartsCard'
import { PartsRollupCard } from '@/components/technical/PartsRollupCard'

/** Tab Định mức: bộ gồm những món nào, định mức chi tiết, rồi tổng hợp vật tư. */
export function ProductPartsTab({
  productId,
  parts,
  partGroups,
  clusters,
  setItems,
  paintCoverage,
  baseMaterial,
  canEdit,
}: {
  productId: string
  parts: PartView[]
  partGroups: PartGroupView[]
  clusters: ClusterView[]
  setItems: SetItemView[]
  /** m² sơn phủ được trên 1 kg sơn — biểu mẫu hard-code 5. */
  paintCoverage: number | null
  /** Ô "Nhiên Liệu" của SP ('AL' | 'IR' | 'IN') — mặc định cho khối mới. */
  baseMaterial: string | null
  canEdit: boolean
}) {
  return (
    <div className="flex flex-col gap-6">
      <SetItemsCard items={setItems} />
      <ProductPartsCard
        parts={parts}
        partGroups={partGroups}
        clusters={clusters}
        productId={productId}
        baseMaterial={baseMaterial}
        canEdit={canEdit}
      />
      <PartsRollupCard parts={parts} paintCoverage={paintCoverage} />
    </div>
  )
}
