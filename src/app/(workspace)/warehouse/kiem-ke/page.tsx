import { authService } from '@/modules/core/auth/auth.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { binsRepo, warehousesRepo } from '@/modules/dept/warehouse/stock.repo'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'
import { KiemKeScreen } from './KiemKeScreen'

/**
 * ĐỢT KIỂM KÊ — danh sách (Khuôn C của `/design-lab`).
 *
 * Thay màn `/warehouse/stocktake` của Đợt 1, vốn là hàng rào tạm: nó bắt chọn
 * phạm vi bằng một bộ lọc trên URL, không lưu được, và không có sổ đóng băng.
 * Hệ quả đo được không phải giả thuyết — biên bản DUY NHẤT từng lập bằng màn
 * đó là `KK-2026-0004` ngày 15/09/2026, xoá sạch 116 mã về 0.
 *
 * Màn cũ CÒN URL nhưng đã rút khỏi menu: gỡ hẳn là một bước riêng, sau khi
 * đợt chạy thật ít nhất một lần. Để hai cửa vào cùng sửa được tồn là đúng thứ
 * bản thiết kế chê, nên chỉ còn MỘT cửa — cửa này.
 */
export default async function KiemKePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const user = await authService.requirePageUser()
  const sp = await searchParams
  const status = (['open', 'counting', 'review', 'approved', 'cancelled'] as const).find(
    (s) => s === sp.status,
  )
  const page = Math.max(1, Number(sp.page) || 1)

  const canEdit =
    user.role === 'admin' || (await canAction(user, 'warehouse.stock.write'))

  const warehouseId = await warehousesRepo.mainId()
  const [{ rows, total }, bins, taxonomy] = await Promise.all([
    stocktakesService.list(user, { status, page, page_size: 50 }),
    binsRepo.list(warehouseId, { active_only: true }),
    materialTaxonomy(),
  ])

  return (
    <KiemKeScreen
      takes={rows}
      total={total}
      page={page}
      status={status ?? null}
      canEdit={canEdit}
      /* Chỉ khu THẬT: đếm khu ảo (tiếp nhận / khoá / phế) không phải kiểm kê
         kho, đó là xem hàng đang mắc ở đâu — việc của màn Hàng mắc. */
      bins={bins
        .filter((b) => b.kind === 'store')
        .map((b) => ({ id: b.id, code: b.code, name: b.name }))}
      groups={taxonomy.groups.map((g) => g.name)}
    />
  )
}
