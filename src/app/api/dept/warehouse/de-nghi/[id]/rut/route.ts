import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

type Params = { params: Promise<{ id: string }> }

/** Rút về nháp khi lãnh đạo chưa duyệt. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await deNghiService.withdraw(user, id)
  return NextResponse.json({ ok: true })
})
