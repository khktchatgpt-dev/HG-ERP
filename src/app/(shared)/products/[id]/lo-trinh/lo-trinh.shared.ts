import type { ProductCluster, ProductPart } from '@/modules/dept/technical/technical.repo'
import type { StageConfig } from '@/lib/stage-config'

/**
 * Kiểu dùng chung của màn Lộ trình (0288, B2). Chỉ `import type` từ
 * `@/modules/*` (luật hg/client-server-boundary).
 */

export type PartRow = Pick<
  ProductPart,
  'id' | 'part_name' | 'group_code' | 'cluster_id' | 'qty' | 'stages'
>
export type ClusterRow = Pick<
  ProductCluster,
  'id' | 'name' | 'qty_per_product' | 'stages'
>

export type LoTrinhProps = {
  productId: string
  productCode: string
  productName: string
  bomRev: number | null
  locked: boolean
  clusters: ClusterRow[]
  parts: PartRow[]
  /** Nhãn nhóm vật tư (partGroupsRepo). */
  groupLabels: Record<string, string>
  stages: StageConfig[]
  canEdit: boolean
}

/** Bản nháp: id (cụm hoặc dòng) → danh sách công đoạn; null = suy theo nhóm. */
export type Draft = Record<string, string[] | null>

export const sameStages = (a: string[] | null, b: string[] | null) =>
  a === b ||
  (a !== null && b !== null && a.length === b.length && a.every((s, i) => s === b[i]))

/** Ghép lớp — không template string có khoảng trắng đầu (hook format lột mất). */
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

export { shortStageLabel } from '@/lib/stage-config'
