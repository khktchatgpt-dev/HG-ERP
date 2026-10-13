import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'

const querySchema = z.object({
  customer_id: z.string().uuid(),
  currency: z.string().length(3),
})

/**
 * Đơn giá gần nhất đã bán cho khách, theo SP — gợi ý giá khi thêm SP vào form đơn
 * (sau giá chào, trước Giá bán KH — lib/sale-price `suggestPrice`). 13/10/2026.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  await assertAction(user, 'sales.order.manage')
  const { customer_id, currency } = parseQuery(new URL(req.url), querySchema)
  return NextResponse.json({
    prices: await ordersRepo.lastPricesForCustomer(customer_id, currency),
  })
})
