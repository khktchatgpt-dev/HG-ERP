import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/** Bắt đầu đếm — chốt sổ tại giờ server và sinh dòng đếm (Kho B7b). */
export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    return NextResponse.json(await stocktakesService.startCounting(user, id))
  },
)
