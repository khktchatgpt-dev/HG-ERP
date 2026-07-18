import { LsxDetailScreen } from '../../../production/lsx/[id]/LsxDetailScreen'

/**
 * Chi tiết LSX trong shell Kế hoạch - Cung ứng — tra cứu khi theo dõi đơn/đặt
 * vật tư; vai Kế hoạch sửa được bảng chi tiết. Không nhảy sang shell Sales.
 */
export default async function PlanningLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="planning" />
}
