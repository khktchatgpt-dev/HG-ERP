import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'

const querySchema = z.object({ production_order_id: z.string().uuid() })

/**
 * Đã cấp còn lại (net) của một LSX — prefill form HOÀN KHO (K2): chỉ trả được
 * thứ đã lĩnh, tối đa bằng phần đã lĩnh chưa hoàn.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { production_order_id } = parseQuery(new URL(req.url), querySchema)
  const items = await stockService.lsxIssuedForReturn(user, production_order_id)
  return NextResponse.json({ items })
})
