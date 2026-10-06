import { authService } from '@/modules/core/auth/auth.service'
import { salesAnalysisService } from '@/modules/dept/sales/sales-analysis.service'
import { PhanTichDoanhSoScreen } from './PhanTichDoanhSoScreen'

export const metadata = { title: 'Bán hàng · Phân tích doanh số' }
export const dynamic = 'force-dynamic'

/**
 * PHÂN TÍCH DOANH SỐ — đơn đã nhận dồn vào đâu (khách, loại hàng, khung, SP,
 * tháng) và lãi kế hoạch trên phần đã có giá thành (bản vẽ duyệt 06/10/2026).
 * Giá thành chỉ tới người có `technical.plan_cost.view` — lọc ở service.
 */
export default async function Page() {
  const user = await authService.requirePageUser()
  const { dongs, canSeeCost } = await salesAnalysisService.board(user)
  return <PhanTichDoanhSoScreen dongs={dongs} canSeeCost={canSeeCost} />
}
