import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { quoteUpdateSchema } from '@/modules/dept/sales/quotes.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const result = await quotesService.detail(user, id)
  return NextResponse.json(result)
})

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, quoteUpdateSchema)
  const quote = await quotesService.update(user, id, input)
  return NextResponse.json({ quote })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await quotesService.remove(user, id)
  return NextResponse.json({ ok: true })
})
