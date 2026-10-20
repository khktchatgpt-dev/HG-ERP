import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { paymentTermsService } from '@/modules/dept/accounting/payment-terms.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { DieuKhoanScreen } from './DieuKhoanScreen'

export const metadata = { title: 'Tài chính · Hạn thanh toán công nợ' }
export const dynamic = 'force-dynamic'

/**
 * HẠN THANH TOÁN CÔNG NỢ — khoản nào đến hạn khi nào, và hạn đó lấy từ đâu.
 *
 * Bản đầu của màn này bắt khai số ngày cho 164 hồ sơ NCC; user chê "rất khó
 * dùng" và đúng. Nay xoay quanh KHOẢN NỢ, còn việc khai co lại còn một ô mặc
 * định công ty ở đầu trang. Xem `lib/payment-terms.ts` cho chuỗi thừa kế và
 * docs/thiet-ke-cong-no-ncc.md §9 cho thứ tự làm.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')

  const [board, canManage] = await Promise.all([
    paymentTermsService.dueBoard(user),
    canAction(user, 'accounting.payable.manage'),
  ])

  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Hạn thanh toán công nợ">
      <DieuKhoanScreen board={board} canManage={canManage} />
    </WorkspaceShell>
  )
}
