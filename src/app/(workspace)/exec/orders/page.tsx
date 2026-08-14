import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { OrdersOverview } from './OrdersOverview'

/**
 * SỔ ĐƠN HÀNG — góc nhìn Ban Giám đốc, phân tầng theo chuỗi nghiệp vụ
 * KHÁCH → ĐƠN → LỆNH SX → VẬT TƯ (docs/exec-orders-redesign.md, 14/08/2026).
 * Đọc từ v_order_tracking; nhóm ở client. Duyệt phiếu ở Hộp ký, không ở đây.
 */
export default async function ExecOrdersPage() {
  const [rows, stages] = await Promise.all([
    lsxService.tracking(),
    productionRepo.listStages(),
  ])

  return <OrdersOverview rows={rows} stages={stages} />
}
