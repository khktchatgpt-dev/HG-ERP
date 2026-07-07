import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import {
  quoteCreateSchema,
  quoteListQuerySchema,
} from '@/modules/dept/sales/quotes.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), quoteListQuerySchema)
  const result = await quotesService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, quoteCreateSchema)
  const quote = await quotesService.create(user, input)
  return NextResponse.json({ quote }, { status: 201 })
})
