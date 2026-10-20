import { notFound } from 'next/navigation'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { poCostsRepo } from '@/modules/dept/supply/po-costs.repo'
import { HttpError } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { HoSoDonViScreen } from './HoSoDonViScreen'
import { toCostRow } from '../../van-chuyen.shared'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await poCostsRepo.carrierById(id).catch(() => null)
  return { title: c ? `Vận chuyển · ${c.name}` : 'Vận chuyển · Đơn vị' }
}

/**
 * HỒ SƠ ĐƠN VỊ VẬN CHUYỂN — Khuôn E (artboard 13b). Không có vòng đời duyệt;
 * chỗ của ba trục trạng thái là DẢI HIỆU SUẤT theo việc vận chuyển: chuyến ·
 * phí · chờ trả · trả đúng hẹn · chi hộ — mỗi ô kèm mẫu số, không đo được thì
 * nói "chưa đo được", không ghi 0.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  let detail
  try {
    detail = await poCostsService.carrierDetail(user, id)
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) notFound()
    throw e
  }
  const [canRecord, users] = await Promise.all([
    canAction(user, 'supply.po_cost.manage'),
    usersRepo.list({ active_only: true }),
  ])
  return (
    <HoSoDonViScreen
      carrier={detail.carrier}
      costs={detail.costs.map(toCostRow)}
      today={todayVn()}
      canRecord={user.role === 'admin' || canRecord}
      me={{ id: user.id, name: user.name ?? user.email }}
      payers={users.map((u) => ({ id: u.id, name: u.name ?? u.email }))}
    />
  )
}
