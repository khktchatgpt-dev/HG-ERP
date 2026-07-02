import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productCreateSchema, productListQuerySchema } from '@/modules/dept/technical/technical.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), productListQuerySchema)
  const result = await productsService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, productCreateSchema)
  const product = await productsService.create(user, input)
  return NextResponse.json({ product }, { status: 201 })
})
