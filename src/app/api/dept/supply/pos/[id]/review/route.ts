import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poReviewService } from '@/modules/dept/supply/po-review.service'
import { poReviewSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Trưởng phòng Cung ứng: "Đã xem — trình GĐ" (05/11/2026), ghi chú không bắt buộc. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { note, tu } = await parseJson(req, poReviewSchema)
  const out = await poReviewService.review(user, id, note, tu)
  return NextResponse.json(out)
})
