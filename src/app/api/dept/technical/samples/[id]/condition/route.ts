import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { samplesService } from '@/modules/dept/technical/samples.service'
import { sampleConditionSchema } from '@/modules/dept/technical/samples.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { condition, note } = await parseJson(req, sampleConditionSchema)
  await samplesService.changeCondition(user, id, condition, note ?? null)
  return NextResponse.json({ ok: true })
})
