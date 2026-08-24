import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { supplierPaymentCreateSchema } from '@/modules/dept/accounting/accounting.schema'
import { payablesService } from '@/modules/dept/accounting/payables.service'

/** Ghi 1 bút toán thanh toán NCC (0167). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, supplierPaymentCreateSchema)
  await payablesService.recordPayment(user, input)
  return NextResponse.json({ ok: true }, { status: 201 })
})
