import { authService } from '@/modules/core/auth/auth.service'
import { payablesService } from '@/modules/dept/accounting/payables.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { PayablesManager } from './PayablesManager'

export const dynamic = 'force-dynamic'

/** Sổ công nợ NCC (GĐ C.1) — phát sinh từ phiếu nhập có giá, trừ đã trả. */
export default async function PayablesPage() {
  const user = await authService.requirePageUser()
  const [{ rows, grand }, canManage] = await Promise.all([
    payablesService.list(user),
    canAction(user, 'accounting.payable.manage'),
  ])
  return <PayablesManager rows={rows} grand={grand} canManage={canManage} />
}
