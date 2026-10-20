import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { apAgingService } from '@/modules/dept/accounting/ap-aging.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { TuoiNoScreen } from './TuoiNoScreen'

export const metadata = { title: 'Tài chính · Tuổi nợ nhà cung cấp' }
export const dynamic = 'force-dynamic'

/**
 * TUỔI NỢ NCC — báo cáo số một của phân hệ công nợ.
 *
 * Không có nó thì không ai biết nên trả ai trước, và một hoá đơn quá hạn 90 ngày
 * trông y hệt một hoá đơn còn 20 ngày. Xem docs/cong-no-ncc-va-da-tien-te.md §2.3.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')
  const data = await apAgingService.overview(user)
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Tuổi nợ nhà cung cấp">
      <TuoiNoScreen {...data} />
    </WorkspaceShell>
  )
}
