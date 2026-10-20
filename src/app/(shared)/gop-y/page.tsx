import { authService } from '@/modules/core/auth/auth.service'
import { feedbackService } from '@/modules/core/feedback/feedback.service'
import { FeedbackScreen } from './FeedbackScreen'

export const metadata = { title: 'Góp ý hệ thống' }

/**
 * GÓP Ý HỆ THỐNG — trang DÙNG CHUNG (mọi người đăng nhập xem được, giữ sidebar
 * phòng mình). `?id=` mở thẳng một góp ý (đích của thông báo).
 */
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const user = await authService.requirePageUser()
  const [{ id }, data] = await Promise.all([searchParams, feedbackService.list(user, 'all')])
  return <FeedbackScreen initialItems={data.items} initialMeta={data.meta} initialId={id ?? null} />
}
