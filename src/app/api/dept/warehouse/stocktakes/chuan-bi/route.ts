import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/**
 * Dữ liệu hộp Mở đợt kiểm kê (B7a): nhóm · có tồn · sẽ đếm · kiểm lần cuối,
 * người đếm, cảnh báo hàng của lệnh chưa ghi xuất. Tải khi mở hộp (~2 s), không
 * tải cùng sổ đợt.
 */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await stocktakesService.chuanBiMoDot(user))
})
