import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { stocktakeCancelSchema } from '@/modules/dept/warehouse/stocktakes.schema'

type Params = { params: Promise<{ id: string }> }

/** Huỷ đợt chưa duyệt. Đợt đã duyệt thì đảo phiếu KK, không huỷ đợt. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, stocktakeCancelSchema)
  await stocktakesService.cancel(user, id, reason ?? '')
  return NextResponse.json({ ok: true })
})
