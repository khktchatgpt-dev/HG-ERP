import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { samplesService } from '@/modules/dept/technical/samples.service'
import { sampleStatusSchema } from '@/modules/dept/technical/samples.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { status, note } = await parseJson(req, sampleStatusSchema)
  await samplesService.changeStatus(user, id, status, note ?? null)
  return NextResponse.json({ ok: true })
})
