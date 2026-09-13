import { authService } from '@/modules/core/auth/auth.service'
import { CutPlanScreen } from './CutPlanScreen'

export const metadata = { title: 'Quy cắt phôi' }

/**
 * QUY CẮT PHÔI — trang DÙNG CHUNG: Kỹ thuật / Kế hoạch lập quy cắt, xưởng cắt
 * theo và in phiếu. Thuật toán chạy ngay trên trình duyệt (`lib/cut-plan`),
 * chỉ gọi server khi nạp định mức từ lệnh / hồ sơ SP và khi xuất Excel.
 */
export default async function CutPlanPage() {
  await authService.requirePageUser()
  return <CutPlanScreen />
}
