import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tripsService } from '@/modules/dept/supply/trips.service'
import { tripCancelSchema } from '@/modules/dept/supply/trips.schema'

type Params = { params: Promise<{ id: string }> }

/** Huỷ chuyến hàng — không xoá, bắt lý do. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, tripCancelSchema)
  await tripsService.cancel(user, id, reason)
  return NextResponse.json({ ok: true })
})
