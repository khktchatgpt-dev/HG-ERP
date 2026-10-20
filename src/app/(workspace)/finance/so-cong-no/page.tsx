import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { apLedgerService } from '@/modules/dept/accounting/ap-ledger.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { SoCongNoScreen } from './SoCongNoScreen'

export const metadata = { title: 'Tài chính · Sổ công nợ phải trả (TK 331)' }
export const dynamic = 'force-dynamic'

/**
 * SỔ CHI TIẾT CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN — cửa vào chính của phân hệ công nợ.
 *
 * Mọi màn công nợ khác là ảnh chụp "tại thời điểm này"; chỉ màn này làm việc
 * theo KỲ, nên chỉ nó chốt sổ và lên báo cáo tài chính được. Xem docstring của
 * `src/lib/ap-ledger.ts` cho hai quyết định nền: phát sinh tăng là HOÁ ĐƠN (không
 * phải phiếu nhập), và tiền tệ không bao giờ cộng lẫn.
 *
 * Kỳ + NCC đang soi nằm trên URL (`?ky=&ncc=&tt=`) chứ không trong state: kế
 * toán gửi đường dẫn cho nhau khi đối chiếu, và F5 phải ra đúng trang cũ.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ ky?: string; ncc?: string; tt?: string }>
}) {
  const user = await authService.requirePageUser()
  if (!(await canAction(user, 'accounting.payable.view'))) redirect('/finance')
  const sp = await searchParams
  const data = await apLedgerService.overview(user, {
    month: /^\d{4}-\d{2}$/.test(sp.ky ?? '') ? sp.ky : undefined,
    supplier_id: sp.ncc,
    currency: sp.tt,
  })
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Sổ công nợ phải trả">
      <SoCongNoScreen {...data} />
    </WorkspaceShell>
  )
}
