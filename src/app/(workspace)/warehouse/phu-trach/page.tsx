import { authService } from '@/modules/core/auth/auth.service'
import { phuTrachService } from '@/modules/dept/warehouse/phu-trach.service'
import { PhuTrachScreen } from './PhuTrachScreen'

export const metadata = { title: 'Kho · Phụ trách nhóm vật tư' }
export const dynamic = 'force-dynamic'

/**
 * PHỤ TRÁCH NHÓM VẬT TƯ — `/warehouse/phu-trach` (B1, bản vẽ 27qPqf6o…, duyệt
 * 24/11/2026). Thủ kho gán mỗi nhóm cho một nhân viên Kho; nhân viên chỉ xem.
 */
export default async function PhuTrachPage() {
  const user = await authService.requirePageUser()
  const data = await phuTrachService.trang(user)
  return <PhuTrachScreen data={data} />
}
