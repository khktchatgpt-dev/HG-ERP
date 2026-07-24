import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { RunningLsxList } from '@/components/production/RunningLsxList'

export const dynamic = 'force-dynamic'

/** Lệnh đang chạy — bối cảnh cho Kế hoạch. */
export default async function PlanLsxInfoPage() {
  const user = (await authService.currentUser())!
  const { rows } = await jobsService.overview(user)
  return (
    <RunningLsxList
      rows={rows}
      myStages={{}}
      lsxBase="/kehoach-sx/lsx"
      breadcrumbs={[
        { label: 'Kế hoạch sản xuất', href: '/kehoach-sx' },
        { label: 'Lệnh đang chạy' },
      ]}
      description="Toàn bộ lệnh đang chạy — thực tế vs kế hoạch."
    />
  )
}
