import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poSignatureService } from '@/modules/dept/supply/po-signature.service'

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  reason: z.string().trim().min(5, 'Ghi rõ lý do (ít nhất 5 ký tự)'),
})

/** Thu hồi chữ ký — đơn đã duyệt, chưa gửi NCC → chờ duyệt (0218). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, schema)
  const po = await poSignatureService.unapprove(user, id, reason)
  return NextResponse.json({ po })
})
