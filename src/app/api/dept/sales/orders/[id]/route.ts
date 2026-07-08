import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { orderUpdateSchema } from '@/modules/dept/sales/orders.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const result = await ordersService.detail(user, id)
  return NextResponse.json(result)
})

/** Cập nhật khi khách thay đổi — diff được ghi lịch sử (FR-SAL-05). */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, orderUpdateSchema)
  const order = await ordersService.update(user, id, input)
  return NextResponse.json({ order })
})
