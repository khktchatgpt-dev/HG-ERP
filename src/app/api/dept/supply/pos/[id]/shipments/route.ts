import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poShipmentInputSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Kế hoạch giao của đơn — chi tiết đơn + form nhập kho (GĐ2) cùng đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const shipments = await posService.listShipments(user, id)
  return NextResponse.json({ shipments })
})

const addSchema = z.object({
  shipments: z.array(poShipmentInputSchema).min(1).max(20),
})

/** Thêm đợt bổ sung (NCC hẹn giao bù phần thiếu) — đơn đã xác nhận, chưa về đủ. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, addSchema)
  await posService.addShipments(user, id, input.shipments)
  return NextResponse.json({ ok: true })
})
