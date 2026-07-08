import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poDecideSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** GĐ duyệt / từ chối đơn đặt vật tư (BR-05, FR-ADM-03). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { decision, reason } = await parseJson(req, poDecideSchema)
  const po = await posService.decide(user, id, decision, reason)
  return NextResponse.json({ po })
})
