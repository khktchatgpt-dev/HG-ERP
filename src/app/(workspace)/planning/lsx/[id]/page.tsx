import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { buildLsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { LsxPoScreen } from './LsxPoScreen'

export const dynamic = 'force-dynamic'

/**
 * ĐƠN MUA CỦA LỆNH — cửa vào từ danh sách `/planning/lsx` (03/09/2026).
 *
 * Route này TRƯỚC ĐÂY render `LsxDetailScreen` (hồ sơ lệnh dùng chung với
 * xưởng/GĐ). Đổi vì trong shell Cung ứng, bấm vào một lệnh nghĩa là "cho tôi
 * xem các đơn của lệnh này", không phải "cho tôi xem bảng chi tiết sản phẩm".
 * Hồ sơ lệnh đầy đủ chuyển sang `/planning/lsx/[id]/ho-so`, có nút dẫn sang ở
 * đầu trang nên không mất đường đi.
 */
export default async function PlanningLsxPoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const today = new Date().toISOString().slice(0, 10)
  const [detail, canEdit] = await Promise.all([
    buildLsxSupplyDetail(user, id, today),
    // Cùng quyền mà `lsxService.setMaterialsDue` kiểm ở server — ô ngày chỉ để
    // sửa được khi bấm vào sẽ không bị 403. Server vẫn là chỗ chốt.
    canAction(user, 'supply.po.manage'),
  ])
  if (!detail) notFound()
  return <LsxPoScreen lsx={detail} today={today} canEdit={canEdit} />
}
