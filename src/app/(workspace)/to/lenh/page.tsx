import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { RunningLsxList } from '@/components/production/RunningLsxList'

export const dynamic = 'force-dynamic'

/**
 * LỆNH ĐANG CHẠY — thông tin chung cho tổ (0087): mọi lệnh + chip công đoạn,
 * TÔ VIỀN công đoạn tổ mình để biết chuỗi tới đâu / tổ trước xong chưa.
 */
export default async function TeamLsxInfoPage() {
  const user = (await authService.currentUser())!
  const [{ rows }, board] = await Promise.all([
    jobsService.overview(user),
    jobsService.teamBoard(user, {}),
  ])
  // Công đoạn tổ mình per lệnh — serializable (Record) qua ranh giới RSC.
  const myStages: Record<string, string[]> = {}
  for (const c of board.cards) {
    ;(myStages[c.production_order_id] ??= []).push(c.stage)
  }
  return (
    <RunningLsxList
      rows={rows}
      myStages={myStages}
      lsxBase="/to/lsx"
      breadcrumbs={[
        { label: 'Tổ sản xuất', href: '/to' },
        { label: 'Lệnh đang chạy' },
      ]}
      description="Toàn bộ lệnh xưởng đang chạy — ô viền xanh là công đoạn tổ mình phụ trách."
    />
  )
}
