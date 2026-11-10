import { notFound, redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { canManagePlan, isProductionStaff } from '@/modules/dept/production/perms'
import { HttpError } from '@/server/http'
import { GiaoToScreen } from './GiaoToScreen'

export const dynamic = 'force-dynamic'

/**
 * GIAO TỔ & HẠN một lệnh — dựng lại KHÔNG kit 10/11/2026 (bản vẽ
 * https://claude.ai/artifact/3m3pok6LKJ96dyZncUAqYV, khuôn F). Một lưới dòng
 * SP × công đoạn thay 8–37 thẻ của PlanEditor cũ; bảng "Tiến độ theo công
 * đoạn" bỏ (Hồ sơ lệnh + khối Khối lượng đã trả lời); nhật ký thành tab.
 * Mọi số đã tính ở server (`planService.get`): cần theo đơn vị, khối lượng,
 * tổ, nhật ký — client chỉ giữ nháp.
 */
export default async function GiaoToPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await authService.requirePageUser()
  // Màn ĐIỀU PHỐI (0086): thành viên xưởng thường không xem — về màn của vai.
  const canEdit = await canManagePlan(user)
  if (user.role === 'employee' && !canEdit && (await isProductionStaff(user))) {
    redirect('/to')
  }
  let data
  try {
    data = await planService.get(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  return <GiaoToScreen data={data} canEdit={canEdit} />
}
