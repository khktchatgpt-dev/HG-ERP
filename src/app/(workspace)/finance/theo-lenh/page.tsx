import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { lsxFinanceService } from '@/modules/dept/accounting/lsx-finance.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { TheoLenhScreen } from './TheoLenhScreen'

export const metadata = { title: 'Tài chính · Theo lệnh sản xuất' }

/**
 * TIỀN THEO LỆNH SẢN XUẤT.
 *
 * Câu hỏi của trang: *"Lệnh này đã trót cam kết bao nhiêu tiền với nhà cung cấp,
 * về được bao nhiêu, NCC đã đòi bao nhiêu, và còn kẹt ở đâu."*
 *
 * KHÔNG phải giá thành: giá thành cần vật tư xuất kho + nhân công, cả hai đang
 * là 0 trong sổ. Xem docstring `lib/lsx-finance.ts`.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tatca?: string; tt?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.supplier_invoice.view'))) redirect('/finance')

  const { tatca, tt } = await searchParams
  const data = await lsxFinanceService.overview(user, {
    activeOnly: !tatca,
    currency: tt?.toUpperCase(),
  })

  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Tiền theo lệnh sản xuất">
      <TheoLenhScreen {...data} activeOnly={!tatca} />
    </WorkspaceShell>
  )
}
