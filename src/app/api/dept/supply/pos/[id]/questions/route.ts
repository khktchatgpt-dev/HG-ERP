import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poSignatureService } from '@/modules/dept/supply/po-signature.service'

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  body: z.string().trim().min(1, 'Câu hỏi đang trống').max(2000),
})

/** Các mạch câu hỏi của Giám đốc trên đơn (0218). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const questions = await poSignatureService.questions(user, id)
  return NextResponse.json({ questions })
})

/** Hỏi lại / Yêu cầu xem lại — không đổi trạng thái đơn. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { body } = await parseJson(req, schema)
  const question = await poSignatureService.ask(user, id, body)
  return NextResponse.json({ question })
})
