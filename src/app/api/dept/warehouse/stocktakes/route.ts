import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakeOpenSchema } from '@/modules/dept/warehouse/stocktakes.schema'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/** Mở đợt kiểm kê (Kho B7a) — chốt phạm vi, CHƯA chốt sổ (chốt khi bắt đầu đếm). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, stocktakeOpenSchema)
  return NextResponse.json(await stocktakesService.open(user, input), { status: 201 })
})
