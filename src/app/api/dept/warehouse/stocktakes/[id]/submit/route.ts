import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/** Gửi đối chiếu — chặn khi còn dòng chưa đếm (trống không phải là 0). */
export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    await stocktakesService.submitReview(user, id)
    return NextResponse.json({ ok: true })
  },
)
