import { authService } from '@/modules/core/auth/auth.service'
import { opsService } from '@/modules/dept/production/ops.service'
import { OpsTower } from './OpsTower'

/**
 * THÁP ĐIỀU HÀNH (COO — /exec/ops): vận hành real-time trong ca — sơ đồ xưởng
 * màu, điểm nghẽn WIP giữa các công đoạn, chất lượng + root cause drill-down,
 * cung ứng, sự cố xử lý tại chỗ. Layout exec đã gate manager/admin.
 */
export default async function OpsTowerPage() {
  const user = (await authService.currentUser())!
  const data = await opsService.opsTower(user)
  return <OpsTower data={data} />
}
