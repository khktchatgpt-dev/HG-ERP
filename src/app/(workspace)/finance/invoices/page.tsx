import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import {
  invoicesService,
  isAccountingStaff,
} from '@/modules/dept/accounting/accounting.service'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WORKSPACES } from '@/workspaces/workspaces.config'
import { InvoicesManager } from './InvoicesManager'

const workspace = WORKSPACES.finance

export default async function FinanceInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    direction?: string
    page?: string
  }>
}) {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isAccountingStaff(user))
  if (!allowed) redirect('/')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const { rows, total, sumByCurrency } = await invoicesService.list(user, {
    q: sp.q?.trim() || undefined,
    status: (sp.status as never) || undefined,
    direction: (sp.direction as never) || undefined,
    page,
    page_size: 20,
  })

  const sumLabel =
    Object.entries(sumByCurrency)
      .map(([c, v]) => `${v.toLocaleString('vi-VN')} ${c}`)
      .join(' / ') || '—'

  return (
    <WorkspaceShell
      workspace={workspace}
      title="Hoá đơn"
      subtitle={`${total} hoá đơn • Tổng: ${sumLabel}`}
    >
      <InvoicesManager initial={rows} total={total} page={page} currentUserId={user.id} />
    </WorkspaceShell>
  )
}
