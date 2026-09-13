import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { supplierInvoicesService } from '@/modules/dept/accounting/supplier-invoices.service'
import { supplierInvoicePostSchema } from '@/modules/dept/accounting/supplier-invoices.schema'

type Params = { params: Promise<{ id: string }> }

/** Vào sổ / mở lại — chỉ hoá đơn đã vào sổ mới tính công nợ và mới vào đối chiếu. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { action } = await parseJson(req, supplierInvoicePostSchema)
  const invoice = await supplierInvoicesService.setPosted(user, id, action)
  return NextResponse.json({ invoice })
})
