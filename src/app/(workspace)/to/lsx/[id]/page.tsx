import { LsxDetailScreen } from '@/app/(workspace)/production/lsx/[id]/LsxDetailScreen'

/** Hồ sơ lệnh trong shell Tổ sản xuất. */
export default async function TeamLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="team" />
}
