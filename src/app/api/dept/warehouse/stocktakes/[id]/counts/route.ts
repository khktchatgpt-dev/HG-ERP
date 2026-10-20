import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakeCountsSchema } from '@/modules/dept/warehouse/stocktakes.schema'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/** Ghi số đếm (lưu dở được, nhiều dòng một lượt). Chênh tính lại ở server. */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const { counts } = await parseJson(req, stocktakeCountsSchema)
    return NextResponse.json(await stocktakesService.saveCounts(user, id, counts))
  },
)
