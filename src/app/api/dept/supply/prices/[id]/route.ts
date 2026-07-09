import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { pricesService } from '@/modules/dept/supply/prices.service'
import { pricePatchSchema } from '@/modules/dept/supply/prices.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const patch = await parseJson(req, pricePatchSchema)
  const price = await pricesService.update(user, id, patch)
  return NextResponse.json({ price })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await pricesService.remove(user, id)
  return NextResponse.json({ ok: true })
})
