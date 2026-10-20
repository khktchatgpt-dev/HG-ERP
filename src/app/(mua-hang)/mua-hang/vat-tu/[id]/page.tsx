import { notFound } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { materialProfileService } from '@/modules/dept/supply/material-profile.service'
import { HoSoVatTuScreen } from './HoSoVatTuScreen'

export const metadata = { title: 'Mua hàng · Hồ sơ vật tư' }
export const dynamic = 'force-dynamic'

/**
 * HỒ SƠ VẬT TƯ — mã này mua ở NCC nào, giá bao nhiêu, lần cuối khi nào (bản vẽ
 * duyệt 06/10/2026). Lối vào: tên mã ở danh sách Vật tư, mã ở "Giá đã mua" của
 * hồ sơ NCC, Bảng giá, Tồn kho và dòng hàng của đơn mua.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authService.requirePageUser()
  // Không phải uuid thì Postgres ném lỗi cú pháp — trả 404 sạch thay vì trang lỗi.
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const [d, canEdit] = await Promise.all([
    materialProfileService.get(user, id),
    // Đúng quyền service kiểm khi đổi NCC mặc định — nút không hứa điều service từ chối.
    canAction(user, 'warehouse.material.update_purchasing'),
  ])
  if (!d) notFound()
  return <HoSoVatTuScreen d={d} canEdit={canEdit} />
}
