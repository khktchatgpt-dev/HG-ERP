import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPendingLsxDetail } from '../../data'
import { ApprovalDetailScreen } from '../../../ApprovalDetailScreen'

/**
 * Chi tiết một Lệnh sản xuất CHỜ DUYỆT — trang riêng dưới khu Phê duyệt
 * (không mở hồ sơ SX/Báo cáo CEO). Duyệt/từ chối ngay tại đây.
 */
export default async function ApprovalLsxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const item = await loadPendingLsxDetail(user, id)
  if (!item) notFound()
  return <ApprovalDetailScreen kind="lsx" item={item} nowIso={new Date().toISOString()} />
}
