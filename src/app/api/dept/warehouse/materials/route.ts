import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import {
  materialCreateSchema,
  materialListQuerySchema,
} from '@/modules/dept/warehouse/warehouse.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), materialListQuerySchema)
  const result = await materialsService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, materialCreateSchema)
  const material = await materialsService.create(user, input)
  return NextResponse.json({ material }, { status: 201 })
})
