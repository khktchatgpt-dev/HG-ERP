import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { financeReportService } from '@/modules/dept/accounting/finance-report.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { BaoCaoScreen } from './BaoCaoScreen'

export const metadata = { title: 'Tài chính · Báo cáo mua hàng' }
export const dynamic = 'force-dynamic'

/**
 * BÁO CÁO MUA HÀNG — phễu năm mốc, phía CHI.
 *
 * Màn ƯỚC TÍNH có chủ ý: sổ công nợ chỉ ghi nhận từ phiếu nhập kho (đúng chuẩn),
 * nhưng Kho chưa vào nhịp nên con số đó ~0 trong khi đã cam kết mua 5,68 tỷ.
 * Ở đây lấy thêm hai mốc sớm hơn để lập kế hoạch chi, và phân vùng rõ mốc nào
 * ghi sổ được.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')
  const report = await financeReportService.overview(user)
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Báo cáo mua hàng">
      <BaoCaoScreen {...report} />
    </WorkspaceShell>
  )
}
