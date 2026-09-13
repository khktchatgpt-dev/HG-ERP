import { authService } from '@/modules/core/auth/auth.service'
import { payablesService } from '@/modules/dept/accounting/payables.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { awaitingInvoiceSummary } from '@/modules/dept/accounting/supplier-invoices.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { PayablesManager } from './PayablesManager'

export const dynamic = 'force-dynamic'

/** Sổ công nợ NCC (GĐ C.1) — phát sinh từ phiếu nhập có giá, trừ đã trả. */
export default async function PayablesPage() {
  const user = await authService.requirePageUser()
  const [{ rows, grand }, canManage, awaiting] = await Promise.all([
    payablesService.list(user),
    canAction(user, 'accounting.payable.manage'),
    /*
     * Phần công nợ ĐANG THIẾU CHỨNG TỪ (GR/IR). KHÔNG cộng thêm vào con số công
     * nợ — sổ này vốn tính theo phiếu nhập nên đã gồm rồi. Nó chỉ nói ra phần
     * nào chưa có hoá đơn, để kế toán biết phải đi đòi NCC xuất.
     *
     * Nuốt lỗi: màn công nợ không được chết vì một dòng cảnh báo.
     */
    awaitingInvoiceSummary().catch(() => ({ by_currency: [], supplier_count: 0 })),
  ])
  /*
   * Bọc WorkspaceShell — trang này TRƯỚC GIỜ THIẾU, nên vào bằng link là mất
   * sidebar và không còn đường đi đâu. `(workspace)/layout.tsx` chỉ gác đăng
   * nhập; mỗi trang phải tự bọc vỏ (xem `finance/invoices/page.tsx`).
   */
  return (
    <WorkspaceShell workspace={WORKSPACES.finance} title="Công nợ nhà cung cấp">
      <PayablesManager
        rows={rows}
        grand={grand}
        canManage={canManage}
        awaiting={awaiting}
      />
    </WorkspaceShell>
  )
}
