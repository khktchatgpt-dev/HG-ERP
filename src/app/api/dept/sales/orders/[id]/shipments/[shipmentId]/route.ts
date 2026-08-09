import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'

type Params = { params: Promise<{ id: string; shipmentId: string }> }

/** Gỡ một đợt xuất ghi nhầm — có vết trong lịch sử đơn. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, shipmentId } = await params
  await ordersService.removeShipment(user, id, shipmentId)
  return NextResponse.json({ ok: true })
})
