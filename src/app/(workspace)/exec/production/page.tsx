import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { ProductionScreen } from './ProductionScreen'

/**
 * SẢN XUẤT — tầng theo dõi của khu Giám đốc (15/08/2026). Route /exec/production
 * từng là màn "tiến độ công đoạn" (ProductionPipeline, xoá 14/08 vì xưởng chưa
 * có số); bản này là sổ LỆNH — đếm được ngay từ production_orders, không phụ
 * thuộc dữ liệu công đoạn. Layout exec đã gác quyền.
 */
export default async function ExecProductionPage() {
  const user = await authService.requirePageUser()
  const { rows } = await lsxService.list(user, { page: 1, page_size: 300 })
  return <ProductionScreen rows={rows} />
}
