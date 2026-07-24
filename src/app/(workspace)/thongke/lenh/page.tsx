import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { RunningLsxList } from '@/components/production/RunningLsxList'

export const dynamic = 'force-dynamic'

/** Lệnh đang chạy — bối cảnh cho thống kê (không highlight tổ). */
export default async function StatLsxInfoPage() {
  const user = (await authService.currentUser())!
  const { rows } = await jobsService.overview(user)
  return (
    <RunningLsxList
      rows={rows}
      myStages={{}}
      lsxBase="/thongke/lsx"
      breadcrumbs={[
        { label: 'Thống kê xưởng', href: '/thongke' },
        { label: 'Lệnh đang chạy' },
      ]}
      description="Toàn bộ lệnh đang chạy — tiến độ đọc từ kế hoạch + sổ số liệu."
    />
  )
}
