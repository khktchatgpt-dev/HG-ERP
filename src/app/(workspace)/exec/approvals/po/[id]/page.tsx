import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPoApprovalDetail } from '../../data'
import { loadApprovalNav } from '../../nav'
import { ApprovalDetailScreen } from '../../../ApprovalDetailScreen'
import { ExecKitFrame } from '../../../_shell/KitFrame'

/**
 * Màn KÝ một đơn đặt vật tư — trang riêng dưới khu Phê duyệt. Đơn chờ duyệt:
 * duyệt / trả lại / hỏi lại ngay tại đây. Từ 0218 (01/10/2026) mở được cả đơn
 * ĐÃ KÝ (từ Lịch sử ký): chỉ đọc, kèm thu hồi chữ ký / yêu cầu xem lại / ký bù.
 */
export default async function ApprovalPoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const item = await loadPoApprovalDetail(user, id)
  if (!item) notFound()
  // Bối cảnh đi tuyến tính qua hộp phiếu — cần mã lệnh của đơn, nên đi sau.
  // Đơn không còn trong hộp (đã ký) thì index 0, hai đường đi null.
  const nav = await loadApprovalNav(user, 'po', id, item.lsx_code)
  return (
    <ExecKitFrame>
      <ApprovalDetailScreen
        kind="po"
        item={item}
        nav={nav}
        nowIso={new Date().toISOString()}
      />
    </ExecKitFrame>
  )
}
