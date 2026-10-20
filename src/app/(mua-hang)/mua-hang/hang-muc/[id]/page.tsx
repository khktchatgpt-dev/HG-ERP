import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { HttpError } from '@/server/http'
import { projectsService } from '@/modules/dept/supply/projects.service'
import { projectsRepo } from '@/modules/dept/supply/projects.repo'
import { HoSoHangMucScreen } from './HoSoHangMucScreen'

export const metadata = { title: 'Mua hàng · Hạng mục' }

/**
 * HỒ SƠ HẠNG MỤC (B3 bản vẽ Đầu đơn mua, 12/10/2026) — "việc này đã tiêu bao
 * nhiêu, qua những đơn nào?". Không có vòng duyệt (chỉ mở / đóng) nên chỗ của
 * trạng thái là dải số, mỗi ô kèm mẫu số; số đi qua lib/hang-muc như danh sách.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const [detail, canManage, kinds] = await Promise.all([
    projectsService.detail(user, id).catch((e) => {
      if (e instanceof HttpError && e.status === 404) return null
      throw e
    }),
    canAction(user, 'supply.po.manage'),
    projectsRepo.list().then((rs) => rs.map((r) => r.kind)), // gợi ý ô Loại khi sửa — không cần số
  ])
  if (!detail) notFound()
  return <HoSoHangMucScreen {...detail} canManage={canManage} kinds={kinds} />
}
