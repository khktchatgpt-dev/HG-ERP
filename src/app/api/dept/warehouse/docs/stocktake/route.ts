import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { stocktakeDocSchema } from '@/modules/dept/warehouse/warehouse.schema'

/** Lập phiếu kiểm kê (KK — 0077): biên bản đếm + điều chỉnh tồn dòng lệch. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, stocktakeDocSchema)
  const result = await stockService.createStocktakeDoc(user, input)
  return NextResponse.json(result, { status: 201 })
})
