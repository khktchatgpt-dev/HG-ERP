import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakeAddLineSchema } from '@/modules/dept/warehouse/stocktakes.schema'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

/** Thêm tay một mã vào đợt đang đếm (thấy hàng ngoài kệ mà danh sách không có). */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const { material_id } = await parseJson(req, stocktakeAddLineSchema)
    return NextResponse.json(await stocktakesService.themDong(user, id, material_id), {
      status: 201,
    })
  },
)
