import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { payablesService } from '@/modules/dept/accounting/payables.service'

type Params = { params: Promise<{ id: string }> }

/** Xoá bút toán ghi nhầm — người ghi hoặc Ban quản lý. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await payablesService.deletePayment(user, id)
  return NextResponse.json({ ok: true })
})
