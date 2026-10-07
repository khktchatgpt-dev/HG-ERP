import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService, isSalesUser } from '@/modules/dept/sales/sales.service'
import type { CustomerSort } from '@/modules/dept/sales/sales.repo'
import { SoKhachScreen, type CustomerFilters } from './SoKhachScreen'

const PAGE_SIZE = 20
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const SORTS = new Set<string>(['new', 'old', 'name', 'country'])

/**
 * Sổ khách hàng của Kinh doanh. Lọc / tìm / sắp / phân trang ở SERVER qua query
 * param (`?q=&owner=&status=&sort=&page=`) — bảng khách dài dần theo năm.
 * `owner=none` = chưa gán phụ trách (khác `owner=<uuid>`).
 */
export default async function SalesCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; owner?: string; status?: string; sort?: string; page?: string }>
}) {
  const user = await authService.requirePageUser()
  const allowed = user.role === 'admin' || (await isSalesUser(user))
  if (!allowed) redirect('/')

  const sp = await searchParams
  const q = sp.q?.trim() || undefined
  const page = Math.max(1, Number(sp.page) || 1)
  const status = sp.status === 'inactive' || sp.status === 'all' ? sp.status : ('active' as const)
  const ownerParam = sp.owner === 'none' || UUID_RE.test(sp.owner ?? '') ? sp.owner! : 'all'
  const sort = (SORTS.has(sp.sort ?? '') ? sp.sort : 'new') as CustomerSort

  const [{ rows, total }, all] = await Promise.all([
    salesService.list(user, {
      q,
      owner_id: ownerParam !== 'all' && ownerParam !== 'none' ? ownerParam : undefined,
      unassigned: ownerParam === 'none',
      status,
      sort,
      page,
      page_size: PAGE_SIZE,
    }),
    // Toàn bộ khách (mọi trạng thái) chỉ lấy id · tên · mã · phụ trách: đếm
    // "Của tôi" và báo trùng tên khi thêm. Sổ ~chục khách, rẻ.
    salesService.list(user, { status: 'all', page: 1, page_size: 1000 }),
  ])
  const [counts, activity, members] = await Promise.all([
    salesService.counts(),
    salesService.activity(user, rows.map((c) => c.id)),
    salesService.members([user.id, ...all.rows.map((c) => c.owner_id)]),
  ])

  const filters: CustomerFilters = { q: q ?? '', owner: ownerParam, status, sort }

  return (
    <SoKhachScreen
      customers={rows}
      activity={activity}
      counts={counts}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      filters={filters}
      currentUserId={user.id}
      role={user.role}
      members={members}
      mineCount={all.rows.filter((c) => c.owner_id === user.id).length}
      existing={all.rows.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
    />
  )
}
