import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { capNhatNhanhSchema } from '@/modules/dept/warehouse/stocktakes.schema'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/**
 * Cập nhật số thực tế (B1 "Kho cho người mới", 27/10/2026) — một đợt kiểm kê
 * theo danh sách mã, ghi số đếm một lượt. Trưởng kho: đổi tồn ngay (phiếu KK +
 * phiếu xuất bù cho lệnh). Người khác: chờ trưởng kho duyệt ở Kiểm kê.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, capNhatNhanhSchema)
  return NextResponse.json(await stocktakesService.capNhatNhanh(user, input), {
    status: 201,
  })
})
