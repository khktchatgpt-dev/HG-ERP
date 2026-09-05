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
 */
export default async function LsxBangKePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await authService.requirePageUser()
  const today = new Date().toISOString().slice(0, 10)
  const [data, supplyStaff] = await Promise.all([
    loadLsxBangKe(user, id, today),
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
