import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { certsService } from '@/modules/dept/supply/certs.service'
import { certCreateSchema, certListQuerySchema } from '@/modules/dept/supply/certs.schema'

/** Chứng chỉ NCC (M3): GET theo NCC, POST thêm chứng chỉ. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { supplier_id } = parseQuery(new URL(req.url), certListQuerySchema)
  const certs = await certsService.list(user, supplier_id)
  return NextResponse.json({ certs })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, certCreateSchema)
  const cert = await certsService.create(user, input)
  return NextResponse.json({ cert }, { status: 201 })
})
