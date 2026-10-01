import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poSignatureService } from '@/modules/dept/supply/po-signature.service'

type Params = { params: Promise<{ id: string }> }

/** Ký bù đơn đã gửi gấp — trạng thái giữ nguyên (0218). */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const po = await poSignatureService.signLate(user, id)
  return NextResponse.json({ po })
})
