import { ShapingDetail } from './ShapingDetail'

/** Định hình 1 lệnh trong shell Sản xuất — bản dùng chung ở ShapingDetail.tsx. */
export default async function ProductionShapingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <ShapingDetail
      id={id}
      base="/production/shaping"
      rootCrumb={{ label: 'Sản xuất', href: '/production' }}
    />
  )
}
