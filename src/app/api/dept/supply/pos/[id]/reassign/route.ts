import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poReassignSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Bàn giao đơn cho NV cung ứng khác (0128) — trưởng phòng CƯ / GĐ / admin. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poReassignSchema)
  const po = await posService.reassign(user, id, input.user_id)
  return NextResponse.json({ po })
})
