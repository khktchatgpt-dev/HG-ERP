import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { loadLsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import { BangKeScreen } from './BangKeScreen'

export const dynamic = 'force-dynamic'

/**
 * BẢNG KÊ VẬT TƯ CỦA LỆNH — màn nhân viên Cung ứng mở đầu tiên (B1, 05/09/2026):
 * mỗi mã vật tư một dòng — cần, tồn, đã đặt, nháp, đã về, còn phải đặt. Thay cho
 * sheet "BK thép" mà phòng đang gõ tay trong Excel.
 *
 * `?nhap=1` — tính cả định mức từ BOM CHƯA xác nhận. Mặc định KHÔNG: chỉ định
 * mức đã xác nhận mới được dùng để mua (user chốt 05/09/2026). Cờ nằm trên URL
 * để người dùng gửi link đúng chế độ mình đang xem.
 */
export default async function LsxBangKePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ nhap?: string }>
}) {
  const [{ id }, { nhap }] = await Promise.all([params, searchParams])
  const includeDraft = nhap === '1'
  const user = await authService.requirePageUser()
  const today = new Date().toISOString().slice(0, 10)
  const [data, supplyStaff] = await Promise.all([
    loadLsxBangKe(user, id, today, includeDraft),
    isSupplyStaff(user),
  ])
  if (!data) notFound()
  return (
    <BangKeScreen
      data={data}
      today={today}
      canEdit={user.role === 'admin' || supplyStaff}
    />
  )
}
