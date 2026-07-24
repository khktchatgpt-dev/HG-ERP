import { LsxDetailScreen } from '@/app/(workspace)/production/lsx/[id]/LsxDetailScreen'

/** Hồ sơ lệnh trong shell Kế hoạch sản xuất. */
export default async function ProdplanLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="prodplan" />
}
