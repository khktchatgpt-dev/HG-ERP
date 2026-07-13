import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lastPricesForCustomer, lastPricesGlobal } from '@/modules/dept/sales/quotes.repo'

const querySchema = z.object({ customer_id: z.string().uuid().optional() })

/**
 * Giá bán gần nhất — gợi ý khi lập báo giá (chống báo lệch giá).
 *   ?customer_id=… → theo (khách, SP) như cũ.
 *   không tham số  → theo SP trên MỌI khách (kèm tên khách + SL — bàn chào giá P3).
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { customer_id } = parseQuery(new URL(req.url), querySchema)
  const prices = customer_id
    ? await lastPricesForCustomer(customer_id)
    : await lastPricesGlobal()
  return NextResponse.json({ prices })
})
