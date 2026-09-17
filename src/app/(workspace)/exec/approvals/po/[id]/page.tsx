import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { loadPendingPoDetail } from '../../data'
import { loadApprovalNav } from '../../nav'
import { ApprovalDetailScreen } from '../../../ApprovalDetailScreen'
import { ExecKitFrame } from '../../../_shell/KitFrame'

/**
 * Chi tiết một Đơn đặt vật tư CHỜ DUYỆT — trang riêng dưới khu Phê duyệt.
 * Duyệt/từ chối ngay tại đây (đơn giá trị lớn cũng mở riêng ở đây).
 */
export default async function ApprovalPoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await authService.requirePageUser()
  const { id } = await params
  const item = await loadPendingPoDetail(user, id)
  if (!item) notFound()
  // Bối cảnh đi tuyến tính qua hộp phiếu — xem `approvals/nav.ts`.
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
