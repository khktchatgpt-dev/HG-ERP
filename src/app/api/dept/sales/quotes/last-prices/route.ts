import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lastPricesForCustomer } from '@/modules/dept/sales/quotes.repo'

const querySchema = z.object({ customer_id: z.string().uuid() })

/** Giá bán gần nhất theo khách — gợi ý khi lập báo giá (chống báo lệch giá). */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { customer_id } = parseQuery(new URL(req.url), querySchema)
  const prices = await lastPricesForCustomer(customer_id)
  return NextResponse.json({ prices })
})
