import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'

type Params = { params: Promise<{ id: string }> }

/** Rút đơn CHỜ DUYỆT về nháp để sửa (0128) — notify người duyệt bỏ qua bản cũ. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const po = await posService.withdraw(user, id)
  return NextResponse.json({ po })
})
