import { authService } from '@/modules/core/auth/auth.service'
import { isWarehouseUser } from '@/modules/dept/warehouse/warehouse.service'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { IssueScreen } from './IssueScreen'

export const dynamic = 'force-dynamic'

/**
 * CẤP VẬT TƯ CHO SẢN XUẤT (plan-kho-redesign GĐ1) — luồng xuất kho chính của
 * xưởng. Danh sách lệnh đang chạy; bung một lệnh mới tính nhu cầu (cần / đã
 * cấp / còn) — phép tính 2-3 truy vấn mỗi lệnh, không chạy sẵn cho cả trang.
 */
export default async function WarehouseIssuePage() {
  const user = await authService.requirePageUser()
  const isWh = await isWarehouseUser(user)
  const canEdit = user.role === 'admin' || isWh

  const lsxs = await productionRepo.listActive()
  return (
    <IssueScreen
      lsxs={lsxs.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
        ship_date: l.ship_date,
        materials_received_at: l.materials_received_at,
      }))}
      canEdit={canEdit}
    />
  )
}
