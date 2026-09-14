import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { buildLsxSupplyDetail } from '@/modules/dept/supply/lsx-supply.service'
import { todayVn } from '@/lib/date-vn'
import { LenhScreen } from './LenhScreen'

export const dynamic = 'force-dynamic'

/**
 * Tiêu đề tab mang MÃ LỆNH. Người mua mở ba bốn lệnh ra ba bốn tab để so —
 * tab nào cũng "HG Manager" thì phải bấm từng cái mới biết cái nào là cái nào.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const d = await buildLsxSupplyDetail(user, id, todayVn()).catch(() => null)
  return { title: d ? `Mua hàng · ${d.code}` : 'Mua hàng · Lệnh sản xuất' }
}

/**
 * MỘT LỆNH — "lệnh này thiếu gì, đã đặt những đơn nào" (Đợt 3, 15/09/2026).
 *
 * Tới hôm nay, bấm một mã lệnh ở `/mua-hang/yeu-cau` là RỜI KHỎI KHU MỚI sang
 * `/planning/lsx/[id]` — chủ dự án báo đúng. Người mua đang đi một mạch trong
 * khu Mua hàng thì bị đá về vỏ cũ, mất cả thanh điều hướng lẫn mạch việc.
 *
 * KHÔNG VIẾT SERVICE MỚI: `buildLsxSupplyDetail` là đúng thứ màn cũ dùng, nên
 * hai màn không thể nói khác nhau về cùng một lệnh.
 *
 * Câu màn trả lời, theo đúng thứ tự người mua hỏi:
 *   1. còn thiếu mấy mã, là những mã nào   → dải độ phủ + danh sách hụt
 *   2. đã đặt những đơn nào, đơn nào vướng → bảng đơn của lệnh
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const today = todayVn()
  const [detail, supplyStaff] = await Promise.all([
    buildLsxSupplyDetail(user, id, today),
    isSupplyStaff(user),
  ])
  if (!detail) notFound()
  return (
    <LenhScreen
      lsx={detail}
      today={today}
      canEdit={user.role === 'admin' || supplyStaff}
    />
  )
}
