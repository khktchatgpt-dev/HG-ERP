import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { invoicesService } from '@/modules/dept/accounting/accounting.service'
import { invoiceUpdateSchema } from '@/modules/dept/accounting/accounting.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, invoiceUpdateSchema)
  const invoice = await invoicesService.update(user, id, input)
  return NextResponse.json({ invoice })
})
