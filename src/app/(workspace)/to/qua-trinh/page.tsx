import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { entriesRepo } from '@/modules/dept/production/entries.repo'
import { PageHeader } from '@/components/erp/PageHeader'
import { EmptyState } from '@/components/erp/EmptyState'
import { TeamActivityPanel } from '@/components/production/TeamActivityPanel'

export const dynamic = 'force-dynamic'

/** QUÁ TRÌNH TỔ — hôm nay/7 ngày + sổ thống kê đã ghi cho tổ mình (0087). */
export default async function TeamActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const user = (await authService.currentUser())!
  const { team } = await searchParams
  const board = await jobsService.teamBoard(user, { team })

  const doing = board.cards.filter((c) => c.status === 'doing').length
  let rows: Awaited<ReturnType<typeof entriesRepo.listRecentByTeam>> = []
  if (board.team_id) {
    const since = new Date()
    since.setDate(since.getDate() - 6)
    rows = await entriesRepo.listRecentByTeam(
      board.team_id,
      since.toISOString().slice(0, 10),
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[
          { label: 'Tổ sản xuất', href: '/to' },
          { label: 'Quá trình tổ' },
        ]}
        title="Quá trình của tổ"
        description="Số thống kê đã ghi cho tổ mình — sai thì báo thống kê sửa sổ."
      />
      {!board.team_id ? (
        <EmptyState
          icon="☷"
          title="Chưa xác định tổ"
          description="Nhân viên tổ vào thẳng tổ mình; quản đốc thêm ?team= trên URL."
        />
      ) : (
        <TeamActivityPanel rows={rows} doingCount={doing} full />
      )}
    </div>
  )
}
