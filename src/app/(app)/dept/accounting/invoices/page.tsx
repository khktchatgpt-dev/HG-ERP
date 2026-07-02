import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { invoicesService, isAccountingStaff } from '@/modules/dept/accounting/accounting.service'
import { AppShell } from '@/components/AppShell'
import { InvoicesManager } from './InvoicesManager'

export default async function AcctInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; direction?: string; page?: string }>
}) {
  const user = (await authService.currentUser())!
  if (!(await isAccountingStaff(user))) redirect('/')

  const sp = await searchParams
  const page = Math.max(1, Number(sp.page) || 1)
  const { rows, total, sumByCurrency } = await invoicesService.list(user, {
    q: sp.q?.trim() || undefined,
    status: (sp.status as never) || undefined,
    direction: (sp.direction as never) || undefined,
    page,
    page_size: 20,
  })

  return (
    <AppShell
      title="Hoá đơn"
      subtitle={`${total} hoá đơn • Tổng: ${Object.entries(sumByCurrency).map(([c, v]) => `${v.toLocaleString('vi-VN')} ${c}`).join(' / ') || '—'}`}
    >
      <InvoicesManager
        initial={rows}
        total={total}
        page={page}
        currentUserId={user.id}
      />
    </AppShell>
  )
}
