import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { orderCancelSchema } from '@/modules/dept/sales/orders.schema'

type Params = { params: Promise<{ id: string }> }

/** Huỷ đơn chưa giao — bắt buộc lý do, ghi vào lịch sử thay đổi. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, orderCancelSchema)
  const order = await ordersService.cancel(user, id, reason)
  return NextResponse.json({ order })
})
