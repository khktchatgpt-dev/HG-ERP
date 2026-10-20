import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poAdjustmentSentSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Ghi mốc "đã gửi NCC bản điều chỉnh lần N" (chốt Q4 25/09/2026). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { seq, note } = await parseJson(req, poAdjustmentSentSchema)
  const adjustments = await posService.markAdjustmentSent(user, id, seq, note)
  return NextResponse.json({ adjustments })
})
