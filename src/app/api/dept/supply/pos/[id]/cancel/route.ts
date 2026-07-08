import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCancelSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, poCancelSchema)
  const po = await posService.cancel(user, id, reason)
  return NextResponse.json({ po })
})
