import { authService } from '@/modules/core/auth/auth.service'
import { giaTriDonService } from '@/modules/core/exec/gia-tri-don.service'
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
 * BẤM DÒNG MỞ TRANG CHI TIẾT `[id]` chứ không mở ngăn soi phủ phải (09/10/2026,
 * chủ dự án: "thay vì hiển thị modal, mở trang xem chi tiết hơn") — trang rộng
 * đủ bày từng chứng từ và có địa chỉ riêng để gửi nhau. Phân tích lãi / lỗ
 * (03/10/2026, trang `/exec/lai-lo` đã gỡ) nằm ở trang đó, nên danh sách không
 * còn nạp số kế hoạch.
 *
 * `?tat_ca=1` xem cả lệnh đã đóng.
 */
export default async function GiaTriDonPage({
  searchParams,
}: {
  searchParams: Promise<{ tat_ca?: string }>
}) {
  const [user, sp] = await Promise.all([authService.requirePageUser(), searchParams])
  const board = await giaTriDonService.board(user, { all: sp.tat_ca === '1' })
  return (
    <ExecKitFrame screen>
      <GiaTriDonScreen board={board} />
    </ExecKitFrame>
  )
}
