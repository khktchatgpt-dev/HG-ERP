import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { samplesService } from '@/modules/dept/technical/samples.service'
import { sampleUpdateSchema } from '@/modules/dept/technical/samples.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const [sample, events] = await Promise.all([
    samplesService.get(user, id),
    samplesService.events(user, id),
  ])
  return NextResponse.json({ sample, events })
})

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, sampleUpdateSchema)
  await samplesService.update(user, id, input)
  return NextResponse.json({ ok: true })
})
