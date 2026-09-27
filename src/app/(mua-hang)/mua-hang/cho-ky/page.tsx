import { authService } from '@/modules/core/auth/auth.service'
import { execService } from '@/modules/core/exec/exec.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { ApprovalCenterScreen } from '@/app/(workspace)/exec/approvals/ApprovalCenterScreen'
import { KhongCoQuyenKy } from './KhongCoQuyenKy'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mua hàng · Chờ tôi ký' }

/**
 * CHỜ TÔI KÝ — bên Mua hàng (27/09/2026).
 *
 * CÙNG hộp ký với Ban Giám đốc (`execService.signBox` + `ApprovalCenterScreen`),
 * mở trong khung Mua hàng cho người chỉ có quyền DUYỆT ĐƠN MUA (chị Thảo): chị
 * không vào được khu /exec, nhưng phải ký theo đúng luật của hộp ký — phiếu giá
 * trị lớn không ký hàng loạt. Người vào được cả khu Giám đốc thì thấy đủ các
 * loại phiếu và có "Lịch sử ký" / "Luật ký".
 *
 * Mục menu chỉ hiện với người có quyền duyệt (capability `supply.approve`);
 * ai gõ thẳng địa chỉ mà không có quyền thì thấy lý do, không thấy trang lỗi.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const [canSign, full, rule] = await Promise.all([
    user.role === 'admin' ? true : canAction(user, 'supply.po.approve'),
    user.role === 'admin' ? true : canAction(user, 'exec.approvals.view'),
    user.role === 'admin' ? true : canAction(user, 'exec.threshold.manage'),
  ])
  if (!canSign && !full) return <KhongCoQuyenKy />
  const box = await execService.signBox(user)
  return (
    <ApprovalCenterScreen
      box={box}
      initialKind="po"
      eyebrow="Mua hàng"
      historyHref={full ? '/exec/approvals/history' : null}
      ruleHref={rule ? '/exec/luat-ky' : null}
    />
  )
}
