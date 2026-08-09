import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { shipmentCreateSchema } from '@/modules/dept/sales/orders.schema'

type Params = { params: Promise<{ id: string }> }

/** Ghi một đợt thực xuất cho một dòng đơn (giao hàng từng phần — 0120). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, shipmentCreateSchema)
  await ordersService.recordShipment(user, id, input)
  return NextResponse.json({ ok: true })
})
