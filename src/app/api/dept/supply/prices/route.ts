import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { pricesService } from '@/modules/dept/supply/prices.service'
import {
  priceCreateSchema,
  priceListQuerySchema,
} from '@/modules/dept/supply/prices.schema'

/** Bảng giá NCC (FR-SUP-06): GET lọc theo NCC/vật tư, POST thêm giá chào. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), priceListQuerySchema)
  const prices = await pricesService.list(user, q)
  return NextResponse.json({ prices })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, priceCreateSchema)
  const price = await pricesService.create(user, input)
  return NextResponse.json({ price }, { status: 201 })
})
