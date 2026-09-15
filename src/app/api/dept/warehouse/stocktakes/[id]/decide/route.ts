import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { stocktakeDecideSchema } from '@/modules/dept/warehouse/stocktakes.schema'

type Params = { params: Promise<{ id: string }> }

/** Duyệt (sinh phiếu KK + bút toán N4/X5) hoặc từ chối (về ĐANG ĐẾM). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, stocktakeDecideSchema)
  if (input.decision === 'approve') {
    return NextResponse.json(await stocktakesService.approve(user, id))
  }
  await stocktakesService.reject(user, id, input.reason ?? '')
  return NextResponse.json({ ok: true })
})
