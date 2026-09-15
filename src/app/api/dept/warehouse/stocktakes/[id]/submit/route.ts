import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

type Params = { params: Promise<{ id: string }> }

/** Gửi ĐỐI CHIẾU — chặn nếu còn mã chưa đếm. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await stocktakesService.submitReview(user, id)
  return NextResponse.json({ ok: true })
})
