import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPendingQuoteDetail } from '../../data'
import { ApprovalDetailScreen } from '../../../ApprovalDetailScreen'

/**
 * Chi tiết một BÁO GIÁ chờ duyệt (0149 — Sale trình tuỳ chọn). GĐ so từng dòng
 * với giá đã chào lần trước cho cùng khách rồi ký / trả lại ngay tại đây.
 */
export default async function ApprovalQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const item = await loadPendingQuoteDetail(user, id)
  if (!item) notFound()
  return (
    <ApprovalDetailScreen kind="quote" item={item} nowIso={new Date().toISOString()} />
  )
}
