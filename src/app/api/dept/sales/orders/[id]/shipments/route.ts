import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { z } from 'zod'
import {
  shipmentCreateSchema,
  shipmentsCreateSchema,
} from '@/modules/dept/sales/orders.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Ghi một đợt thực xuất (0120). Thân JSON có `lines[]` = một đợt NHIỀU dòng
 * (một container, 07/10/2026); không có = một dòng như bản cũ.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(
    req,
    z.union([shipmentsCreateSchema, shipmentCreateSchema]),
  )
  if ('lines' in input) await ordersService.recordShipments(user, id, input)
  else await ordersService.recordShipment(user, id, input)
  return NextResponse.json({ ok: true })
})
