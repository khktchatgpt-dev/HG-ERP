import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakeCancelSchema } from '@/modules/dept/warehouse/stocktakes.schema'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/** Huỷ đợt kiểm kê chưa duyệt — chỉ đổi trạng thái, không đụng tồn. */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const { reason } = await parseJson(req, stocktakeCancelSchema)
    await stocktakesService.cancel(user, id, reason ?? '')
    return NextResponse.json({ ok: true })
  },
)
