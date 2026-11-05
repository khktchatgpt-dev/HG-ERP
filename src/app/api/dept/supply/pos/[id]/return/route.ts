import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poReviewService } from '@/modules/dept/supply/po-review.service'
import { poReturnSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Trưởng phòng Cung ứng trả lại để sửa (05/11/2026) — lý do ≥ 5 ký tự. Nháp: đơn
 * giữ nháp, rời hộp tới khi NV sửa; chờ duyệt: về nháp. `tu` = trạng thái màn đang thấy.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason, tu } = await parseJson(req, poReturnSchema)
  const po = await poReviewService.returnForEdit(user, id, reason, tu)
  return NextResponse.json({ po })
})
