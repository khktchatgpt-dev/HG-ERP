import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { invoicesService } from '@/modules/dept/accounting/accounting.service'
import { invoiceCreateSchema, invoiceListQuerySchema } from '@/modules/dept/accounting/accounting.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), invoiceListQuerySchema)
  const result = await invoicesService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, invoiceCreateSchema)
  const invoice = await invoicesService.create(user, input)
  return NextResponse.json({ invoice }, { status: 201 })
})
