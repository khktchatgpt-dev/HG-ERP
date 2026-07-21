import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPendingPoDetail } from '../../data'
import { ApprovalDetailScreen } from '../../../ApprovalDetailScreen'

/**
 * Chi tiết một Đơn đặt vật tư CHỜ DUYỆT — trang riêng dưới khu Phê duyệt.
 * Duyệt/từ chối ngay tại đây (đơn giá trị lớn cũng mở riêng ở đây).
 */
export default async function ApprovalPoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = (await authService.currentUser())!
  const { id } = await params
  const item = await loadPendingPoDetail(user, id)
  if (!item) notFound()
  return <ApprovalDetailScreen kind="po" item={item} nowIso={new Date().toISOString()} />
}
