import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'

const query = z.object({ q: z.string().trim().min(1).max(100) })

/**
 * Tìm vật tư KÈM TỒN trong cả danh mục — đường lùi của ô "+ Thêm dòng" ở màn
 * Xuất hàng, chỉ gọi khi không mã còn tồn (đã nạp sẵn) nào khớp. Một lượt trả
 * luôn tồn dùng được nên chọn xong không phải tra tồn lần hai. Cùng tư thế với
 * `stock/ton`: đọc view `warehouse_stock`, mọi người đăng nhập đều xem được.
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { q } = parseQuery(new URL(req.url), query)
  const rows = await stockRepo.tim(q, 20)
  return NextResponse.json({ rows })
})
