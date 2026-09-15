import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import {
  stocktakeListQuerySchema,
  stocktakeOpenSchema,
} from '@/modules/dept/warehouse/stocktakes.schema'

/** Danh sách đợt kiểm kê (0199). */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), stocktakeListQuerySchema)
  return NextResponse.json(await stocktakesService.list(user, q))
})

/** Mở đợt — chốt PHẠM VI, chưa chốt sổ. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, stocktakeOpenSchema)
  const out = await stocktakesService.open(user, input)
  return NextResponse.json(out, { status: 201 })
})
