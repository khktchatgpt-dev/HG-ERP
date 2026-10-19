import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

const schema = z.object({
  reason: z.string().trim().min(3, 'Ghi lý do ít nhất 3 ký tự').max(1000),
})

/** Trả đợt về "đang đếm" kèm lý do — người đếm biết đếm lại chỗ nào (Kho B7c). */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const { reason } = await parseJson(req, schema)
    await stocktakesService.reject(user, id, reason)
    return NextResponse.json({ ok: true })
  },
)
