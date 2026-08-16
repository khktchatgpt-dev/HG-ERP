import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poShipmentActionSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Thao tác trên MỘT đợt giao: dời ngày (kèm lý do) / xe tới / huỷ (kèm lý do). */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poShipmentActionSchema)
  await posService.shipmentAction(user, id, input)
  return NextResponse.json({ ok: true })
})
