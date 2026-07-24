import { productionRepo } from '@/modules/dept/production/production.repo'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { OrdersOverview } from './OrdersOverview'

/**
 * Quản lý đơn hàng — góc nhìn Ban Giám đốc: sổ đơn theo giá trị & hạn giao +
 * tiến độ sản xuất hiện tại từng đơn, duyệt LSX tại chỗ. Đọc từ v_order_tracking
 * (mở rộng lớp thương mại, migration 0071). Gate ở exec/layout.
 */
export default async function ExecOrdersPage() {
  const [rows, stages] = await Promise.all([
    lsxService.tracking(),
    productionRepo.listStages(),
  ])

  return <OrdersOverview rows={rows} stages={stages} />
}
