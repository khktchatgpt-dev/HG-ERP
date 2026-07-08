import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import {
  supplierCreateSchema,
  supplierListQuerySchema,
} from '@/modules/dept/supply/suppliers.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), supplierListQuerySchema)
  const result = await suppliersService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, supplierCreateSchema)
  const supplier = await suppliersService.create(user, input)
  return NextResponse.json({ supplier }, { status: 201 })
})
