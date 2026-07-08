import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import {
  orderCreateSchema,
  orderListQuerySchema,
} from '@/modules/dept/sales/orders.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), orderListQuerySchema)
  const result = await ordersService.list(user, q)
  return NextResponse.json(result)
})

/** Tạo đơn — từ báo giá đã chốt hoặc trực tiếp không cần báo giá (service kiểm). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, orderCreateSchema)
  const order = await ordersService.create(user, input)
  return NextResponse.json({ order }, { status: 201 })
})
