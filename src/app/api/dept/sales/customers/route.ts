import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService } from '@/modules/dept/sales/sales.service'
import {
  customerCreateSchema,
  customerListQuerySchema,
} from '@/modules/dept/sales/sales.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), customerListQuerySchema)
  const result = await salesService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, customerCreateSchema)
  const customer = await salesService.create(user, input)
  return NextResponse.json({ customer }, { status: 201 })
})
