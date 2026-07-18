import { LsxDetailScreen } from './LsxDetailScreen'

/** Chi tiết LSX cho XƯỞNG — bản dùng chung ở LsxDetailScreen.tsx. */
export default async function ProductionLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="production" />
}
