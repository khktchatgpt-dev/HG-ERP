import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { movementListQuerySchema } from '@/modules/dept/warehouse/warehouse.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), movementListQuerySchema)
  const result = await stockService.listMovements(user, q)
  return NextResponse.json(result)
})
