import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { incomingBucket, isIncoming } from '@/lib/supply-watch'
import { loadWatchPos, todayIso } from '@/app/(workspace)/planning/_data/watch'
import { NhanHangScreen } from './NhanHangScreen'

export const metadata = { title: 'Mua hàng · Nhận hàng' }
export const dynamic = 'force-dynamic'

/**
 * NHẬN HÀNG — Khuôn C, dựng bằng kit (Đợt 3, 15/09/2026). Thay trang tạm.
 *
 * Câu trang trả lời: "Hàng về tới đâu?" — nên TRỤC LÀ THỜI GIAN, không phải
 * trạng thái đơn. Người mua mở màn này để biết tuần này có gì về và có gì phải
 * giục; Kho đọc để xếp chỗ trước.
 *
 * ĐƠN CHƯA GỬI NCC CỐ Ý KHÔNG CÓ MẶT (`isIncoming` loại `approved`): chưa ai
 * chuẩn bị hàng thì xếp nó vào lịch giao là tự trấn an sai. Nó thuộc danh sách
 * việc ở Bàn làm việc — đúng chỗ để bị thúc.
 *
 * KHÔNG VIẾT SERVICE MỚI: `loadWatchPos` + `incomingBucket` là đúng thứ màn
 * `/planning/hang-sap-ve` và badge sidebar đang dùng, nên ba chỗ không thể
 * đếm khác nhau.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const today = todayIso()
  const [{ rows, truncatedAt }, supplyStaff] = await Promise.all([
    loadWatchPos(user),
    isSupplyStaff(user),
  ])

  const enRoute = rows.filter(isIncoming)
  return (
    <NhanHangScreen
      today={today}
      truncatedAt={truncatedAt}
      canEdit={user.role === 'admin' || supplyStaff}
      rows={enRoute.map((p) => ({
        id: p.id,
        code: p.code,
        supplier_name: p.supplier_name,
        lsx_code: p.lsx_code,
        status: p.status,
        expected_at: p.expected_at,
        currency: p.currency,
        total: p.total,
        assignee_name: p.assignee_name,
        lines_done: p.lines_done ?? 0,
        lines_total: p.lines_total ?? 0,
        bucket: incomingBucket(p, today) ?? 'no_eta',
      }))}
    />
  )
}
