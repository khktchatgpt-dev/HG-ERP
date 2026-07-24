import { LsxDetailScreen } from '@/app/(workspace)/production/lsx/[id]/LsxDetailScreen'

/** Hồ sơ lệnh trong shell Thống kê xưởng. */
export default async function StatLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="stat" />
}
