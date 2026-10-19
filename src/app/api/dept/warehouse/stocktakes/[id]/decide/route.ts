import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakeDecideSchema } from '@/modules/dept/warehouse/stocktakes.schema'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/**
 * Duyệt / trả về đợt kiểm kê (Kho B7c). Duyệt sinh phiếu KK (N4 thừa / X5 thiếu)
 * theo chênh SO VỚI SỔ LÚC CHỐT; trả về đưa đợt về "đang đếm" kèm lý do.
 * Người đếm không tự duyệt (chặn ở service).
 */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const { decision, reason } = await parseJson(req, stocktakeDecideSchema)
    if (decision === 'reject') {
      await stocktakesService.reject(user, id, reason ?? '')
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json(await stocktakesService.approve(user, id))
  },
)
