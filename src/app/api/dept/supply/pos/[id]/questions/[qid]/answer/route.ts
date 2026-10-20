import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poSignatureService } from '@/modules/dept/supply/po-signature.service'

type Params = { params: Promise<{ id: string; qid: string }> }

const schema = z.object({
  body: z.string().trim().min(1, 'Câu trả lời đang trống').max(2000),
})

/** Người phụ trách trả lời câu hỏi của Giám đốc — câu hỏi đóng (0218). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, qid } = await params
  const { body } = await parseJson(req, schema)
  await poSignatureService.answer(user, id, qid, body)
  return NextResponse.json({ ok: true })
})
