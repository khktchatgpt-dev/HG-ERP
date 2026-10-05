import { authService } from '@/modules/core/auth/auth.service'
import { giaTriDonService } from '@/modules/core/exec/gia-tri-don.service'
import { laiLoService } from '@/modules/core/exec/lai-lo.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { GiaTriDonScreen } from './GiaTriDonScreen'
import { ExecKitFrame } from '../_shell/KitFrame'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ban Giám đốc · Giá trị đơn theo lệnh' }

/**
 * GIÁ TRỊ ĐƠN THEO LỆNH (/exec/gia-tri-don) — 02/10/2026.
 *
 * Bảng kê hai khối số cộng thẳng từ chứng từ: đơn bán của lệnh và đơn mua cho
 * lệnh, quy VND theo tỷ giá chốt từng chứng từ. Layout exec đã gác quyền.
 *
 * PHÂN TÍCH LÃI / LỖ NẰM TRONG NGĂN SOI (03/10/2026, chủ dự án: "bỏ trang lãi lỗ,
 * xem chi tiết sẽ phân tích bên trong"). Trang `/exec/lai-lo` đã gỡ; số kế hoạch
 * (FOB · giá thành · lợi nhuận) là số riêng của Bán hàng nên CHỈ nạp khi người
 * xem có `technical.plan_cost.view` — không có quyền thì ngăn soi nói vì sao trống.
 *
 * `?tat_ca=1` xem cả lệnh đã đóng.
 */
export default async function GiaTriDonPage({
  searchParams,
}: {
  searchParams: Promise<{ tat_ca?: string }>
}) {
  const [user, sp] = await Promise.all([authService.requirePageUser(), searchParams])
  const all = sp.tat_ca === '1'
  const [board, laiLo] = await Promise.all([
    giaTriDonService.board(user, { all }),
    canAction(user, 'technical.plan_cost.view').then((ok) =>
      ok ? laiLoService.board(user, { all }) : null,
    ),
  ])
  return (
    <ExecKitFrame>
      <GiaTriDonScreen
        board={board}
        phanTich={laiLo ? Object.fromEntries(laiLo.rows.map((r) => [r.lsx_id, r])) : null}
      />
    </ExecKitFrame>
  )
}
