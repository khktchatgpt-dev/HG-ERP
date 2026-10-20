import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'
import {
  supplierInvoiceCreateSchema,
  supplierInvoiceListQuerySchema,
} from '@/modules/dept/accounting/supplier-invoices.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), supplierInvoiceListQuerySchema)
  return NextResponse.json(await supplierInvoicesService.list(user, q))
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, supplierInvoiceCreateSchema)
  const invoice = await supplierInvoicesService.create(user, input)
  return NextResponse.json({ invoice }, { status: 201 })
})
