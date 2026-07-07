import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'
import { db } from '@/server/db'
import { CustomersManager } from './CustomersManager'

export default async function SalesCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isSalesUser(user))
  if (!allowed) redirect('/')

  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)

  const { rows, total } = await salesService.list(user, {
    q,
    page,
    page_size: 20,
    active_only: true,
  })

  const { data: salesMembers } = await db()
    .from('users')
    .select('id, name, email')
    .eq('is_active', true)
    .order('name')

  return (
    <CustomersManager
      initial={rows}
      total={total}
      page={page}
      q={q ?? ''}
      currentUserId={user.id}
      role={user.role}
      members={(salesMembers ?? []).map((m) => ({
        id: m.id,
        label: m.name ?? m.email,
      }))}
    />
  )
}
