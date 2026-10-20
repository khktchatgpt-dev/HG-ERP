import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { giaTriDonService } from '@/modules/core/exec/gia-tri-don.service'
import { laiLoService } from '@/modules/core/exec/lai-lo.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { ExecKitFrame } from '../../_shell/KitFrame'
import { ChiTietLenhScreen } from './ChiTietLenhScreen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Ban Giám đốc · Giá trị đơn của lệnh' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GIÁ TRỊ ĐƠN CỦA MỘT LỆNH (/exec/gia-tri-don/[id]) — 09/10/2026.
 *
 * Thay ngăn soi phủ phải của danh sách (chủ dự án: "thay vì hiển thị modal, mở
 * trang xem chi tiết hơn"). Cùng hai service với danh sách, lọc về MỘT lệnh —
 * con số trên trang này và trên dòng danh sách ra từ cùng một hàm cộng.
 *
 * Phân tích lãi / lỗ cần số kế hoạch (riêng của Bán hàng) nên CHỈ nạp khi người
 * xem có `technical.plan_cost.view`; không có thì khối đó nói vì sao trống.
 *
 * `?tat_ca=1` chỉ để nút quay lại về đúng danh sách người xem vừa rời.
 */
export default async function GiaTriDonLenhPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tat_ca?: string }>
}) {
  const [user, { id }, sp] = await Promise.all([
    authService.requirePageUser(),
    params,
    searchParams,
  ])
  if (!UUID.test(id)) notFound()
  const [board, laiLo] = await Promise.all([
    giaTriDonService.board(user, { lsxId: id }),
    canAction(user, 'technical.plan_cost.view').then((ok) =>
      ok ? laiLoService.board(user, { lsxId: id }) : null,
    ),
  ])
  const row = board.rows[0]
  if (!row) notFound()
  return (
    <ExecKitFrame screen>
      <ChiTietLenhScreen
        row={row}
        phanTich={laiLo ? (laiLo.rows[0] ?? null) : undefined}
        backHref={sp.tat_ca === '1' ? '/exec/gia-tri-don?tat_ca=1' : '/exec/gia-tri-don'}
      />
    </ExecKitFrame>
  )
}
