import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { leaveService } from '@/modules/dept/hr/hr.service'
import { leaveCreateSchema, leaveListQuerySchema } from '@/modules/dept/hr/hr.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), leaveListQuerySchema)
  const result = await leaveService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, leaveCreateSchema)
  const request = await leaveService.create(user, input)
  return NextResponse.json({ request }, { status: 201 })
})
