import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { samplesService } from '@/modules/dept/technical/samples.service'
import {
  sampleCreateSchema,
  sampleListQuerySchema,
} from '@/modules/dept/technical/samples.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), sampleListQuerySchema)
  const [{ rows, total }, stats] = await Promise.all([
    samplesService.list(user, q),
    samplesService.stats(),
  ])
  return NextResponse.json({ samples: rows, total, stats })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, sampleCreateSchema)
  const { codes } = await samplesService.create(user, input)
  return NextResponse.json({ codes }, { status: 201 })
})
