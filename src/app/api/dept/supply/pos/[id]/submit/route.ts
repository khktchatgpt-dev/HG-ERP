import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'

type Params = { params: Promise<{ id: string }> }

/** Gửi GĐ duyệt (0116): draft → pending_approval, lúc này mới notify người duyệt. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const po = await posService.submit(user, id)
  return NextResponse.json({ po })
})
