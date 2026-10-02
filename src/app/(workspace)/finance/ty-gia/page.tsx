import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { fxRatesService } from '@/modules/dept/accounting/fx-rates.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { TyGiaScreen } from './TyGiaScreen'

export const metadata = { title: 'Tài chính · Tỷ giá' }
export const dynamic = 'force-dynamic'

/**
 * TỶ GIÁ — bảng Kế toán nhập, chứng từ đóng băng lúc ghi (0189 + 0219).
 *
 * Câu hỏi của màn: *"tỷ giá đang áp dụng là bao nhiêu, và chứng từ ngoại tệ
 * nào còn chưa có tỷ giá?"* Danh mục, không có vòng đời duyệt — Khuôn C với
 * một hàng nhập ở đầu, chép SAP OB08 / Odoo currency rates.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.fx.view'))) redirect('/finance')

  const [board, canManage] = await Promise.all([
    fxRatesService.board(user),
    canAction(user, 'accounting.fx.manage'),
  ])

  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Tỷ giá">
      <TyGiaScreen board={board} canManage={canManage} />
    </WorkspaceShell>
  )
}
