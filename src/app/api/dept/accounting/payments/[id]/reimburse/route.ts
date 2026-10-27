import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { payablesService } from '@/modules/dept/accounting/payables.service'

type Params = { params: Promise<{ id: string }> }

/** Đã hoàn ứng cho nhân viên trả hộ (0279 — mua trên sàn). */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await payablesService.markReimbursed(user, id)
  return NextResponse.json({ ok: true })
})
