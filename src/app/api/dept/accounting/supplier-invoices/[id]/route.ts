import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'
import { supplierInvoiceUpdateSchema } from '@/modules/dept/accounting/supplier-invoices.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await supplierInvoicesService.detail(user, id))
})

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, supplierInvoiceUpdateSchema)
  const invoice = await supplierInvoicesService.update(user, id, input)
  return NextResponse.json({ invoice })
})

/** Huỷ, KHÔNG xoá: số hoá đơn đã vào sổ là dấu vết phải giữ. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const invoice = await supplierInvoicesService.cancel(user, id)
  return NextResponse.json({ invoice })
})
