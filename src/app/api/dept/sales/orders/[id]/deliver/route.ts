import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { orderDeliverSchema } from '@/modules/dept/sales/orders.schema'

type Params = { params: Promise<{ id: string }> }

/** Xác nhận đã giao hàng (completed → delivered) — ghi vào lịch sử thay đổi. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { note } = await parseJson(req, orderDeliverSchema)
  const order = await ordersService.deliver(user, id, note)
  return NextResponse.json({ order })
})
