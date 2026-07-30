import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'
import { db } from '@/server/db'
import { CustomersManager, type CustomerFilters } from './CustomersManager'

const PAGE_SIZE = 20

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Danh sách khách hàng của Kinh doanh.
 *
 * Lọc/tìm/phân trang đều ở SERVER qua query param (`?q=&owner=&status=&page=`) —
 * bảng KH sẽ dài dần theo năm, lọc ở client là kéo cả bảng về mỗi lần mở trang.
 * `owner=none` = chưa gán phụ trách (khác với `owner=<uuid>`).
 */
export default async function SalesCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    owner?: string
    status?: string
    page?: string
  }>
}) {
  const user = (await authService.currentUser())!
  const allowed = user.role === 'admin' || (await isSalesUser(user))
  if (!allowed) redirect('/')

  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const status =
    sp.status === 'inactive' || sp.status === 'all' ? sp.status : ('active' as const)
  const ownerParam =
    sp.owner === 'none' || UUID_RE.test(sp.owner ?? '') ? sp.owner! : 'all'

  const { rows, total } = await salesService.list(user, {
    q,
    owner_id: ownerParam !== 'all' && ownerParam !== 'none' ? ownerParam : undefined,
    unassigned: ownerParam === 'none',
    status,
    page,
    page_size: PAGE_SIZE,
  })

  const [counts, activity, { data: salesMembers }] = await Promise.all([
    salesService.counts(),
    salesService.activity(
      user,
      rows.map((c) => c.id),
    ),
    db().from('users').select('id, name, email').eq('is_active', true).order('name'),
  ])

  const filters: CustomerFilters = {
    q: q ?? '',
    owner: ownerParam,
    status,
  }

  return (
    <CustomersManager
      customers={rows}
      activity={activity}
      counts={counts}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      filters={filters}
      currentUserId={user.id}
      role={user.role}
      members={(salesMembers ?? []).map((m) => ({
        id: m.id,
        label: m.name ?? m.email,
      }))}
    />
  )
}
