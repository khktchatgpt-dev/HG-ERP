import { redirect } from 'next/navigation'
import { authService } from '@/modules/core/auth/auth.service'
import { isProductionStaff } from '@/modules/dept/production/perms'
import { TaiLenScreen } from './TaiLenScreen'

export const dynamic = 'force-dynamic'

/**
 * TẢI FILE NHẬP LIỆU LÊN — khuôn F, KHÔNG kit (bản vẽ v2 19/11/2026,
 * https://claude.ai/artifact/4N2faPL2w4QHYQTvu5zNjX): đọc file mẫu đã điền, xem trước từng tờ,
 * ghi một lần (từng đợt 10 ngày, có tiến độ). Công đoạn · lệnh · tổ nằm trong file.
 */
export default async function TaiLenPage() {
  const user = await authService.requirePageUser()
  const duocGhi = user.role === 'admin' || (await isProductionStaff(user))
  if (!duocGhi) redirect('/thongke/lenh')
  return <TaiLenScreen />
}
