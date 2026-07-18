import { LsxDetailScreen } from '../../../production/lsx/[id]/LsxDetailScreen'

/**
 * Chi tiết LSX trong shell Ban Giám đốc — GĐ thẩm định và DUYỆT/TỪ CHỐI ngay
 * tại đây, không nhảy sang giao diện Sales (mỗi bộ phận một màn riêng).
 */
export default async function ExecLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LsxDetailScreen id={id} variant="exec" />
}
