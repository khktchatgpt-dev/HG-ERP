import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { catalogsService } from '@/modules/core/catalogs/catalogs.service'
import {
  catalogCreateSchema,
  CATALOG_TYPES,
} from '@/modules/core/catalogs/catalogs.schema'

const listQuerySchema = z.object({ type: z.enum(CATALOG_TYPES).optional() })

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { type } = parseQuery(new URL(req.url), listQuerySchema)
  const items = await catalogsService.list(user, type)
  return NextResponse.json({ items })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, catalogCreateSchema)
  const item = await catalogsService.create(user, input)
  return NextResponse.json({ item }, { status: 201 })
})
