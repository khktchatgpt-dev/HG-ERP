import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poAdvanceSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Tiến trạng thái: gửi NCC (BR-05 — phải approved) / NCC xác nhận / đang giao. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { to } = await parseJson(req, poAdvanceSchema)
  const po = await posService.advance(user, id, to)
  return NextResponse.json({ po })
})
