import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { pricesService } from '@/modules/dept/supply/prices.service'
import { priceCompareQuerySchema } from '@/modules/dept/supply/prices.schema'

/** So giá cho form tạo PO: ?material_ids=uuid,uuid → giá chào các NCC + mua gần nhất. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { material_ids } = parseQuery(new URL(req.url), priceCompareQuerySchema)
  const entries = await pricesService.compare(user, material_ids)
  return NextResponse.json({ entries })
})
