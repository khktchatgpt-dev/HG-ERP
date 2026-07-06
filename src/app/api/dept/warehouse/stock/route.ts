import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { stockListQuerySchema } from '@/modules/dept/warehouse/warehouse.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), stockListQuerySchema)
  const rows = await stockService.listStock(user, q)
  return NextResponse.json({ rows })
})
