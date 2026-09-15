import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'

const querySchema = z.object({
  production_order_id: z.string().uuid(),
  /*
   * Đối chiếu với KHO (sổ §4.1). Mặc định BẬT — bản không đối chiếu nói "còn
   * phải cấp 40 cây" mà không nói kho có 40 cây không, và người đứng ở quầy
   * cầm con số đó đi ra kệ rồi mới biết là không có.
   *
   * Giữ đường tắt `stock=0` cho nơi chỉ cần con số định mức (báo cáo, gợi ý
   * mua) — chúng không cần ba rổ tồn và không nên trả tiền cho hai truy vấn.
   */
  stock: z.enum(['0', '1']).default('1'),
})

/**
 * Nhu cầu vật tư còn phải xuất cho 1 LSX (BOM×SL − đã xuất) — FR-WMS-05.
 * Mặc định kèm đối chiếu kho ba rổ + phần giữ cho lệnh khác (sổ §4.1).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  const needs =
    q.stock === '1'
      ? await stockService.lsxNeedsWithStock(user, q.production_order_id)
      : await stockService.lsxNeeds(user, q.production_order_id)
  return NextResponse.json({ needs })
})
