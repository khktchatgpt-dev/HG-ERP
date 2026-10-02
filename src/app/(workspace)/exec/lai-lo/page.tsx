import { authService } from '@/modules/core/auth/auth.service'
import { laiLoService } from '@/modules/core/exec/lai-lo.service'
import { LaiLoScreen } from './LaiLoScreen'
import { ExecKitFrame } from '../_shell/KitFrame'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ban Giám đốc · Lãi / lỗ theo lệnh' }

/**
 * LÃI / LỖ THEO LỆNH (/exec/lai-lo) — bước 4 của giám sát tài chính (02/10/2026).
 *
 * Kế hoạch của Bán hàng (giá thành · lợi nhuận · FOB, bước 2–3) đặt cạnh tiền
 * mua ĐÃ CAM KẾT, quy VND theo tỷ giá chốt trên từng chứng từ (bước 1). Layout
 * exec đã gác quyền; service kiểm thêm `technical.plan_cost.view`.
 *
 * `?tat_ca=1` xem cả lệnh đã đóng.
 */
export default async function LaiLoPage({
  searchParams,
}: {
  searchParams: Promise<{ tat_ca?: string }>
}) {
  const [user, sp] = await Promise.all([authService.requirePageUser(), searchParams])
  const board = await laiLoService.board(user, { all: sp.tat_ca === '1' })
  return (
    <ExecKitFrame>
      <LaiLoScreen board={board} />
    </ExecKitFrame>
  )
}
