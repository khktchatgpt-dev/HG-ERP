import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'

const querySchema = z.object({ production_order_id: z.string().uuid() })

/** Nhu cầu vật tư còn phải xuất cho 1 LSX (BOM×SL − đã xuất) — FR-WMS-05. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { production_order_id } = parseQuery(new URL(req.url), querySchema)
  const needs = await stockService.lsxNeeds(user, production_order_id)
  return NextResponse.json({ needs })
})
