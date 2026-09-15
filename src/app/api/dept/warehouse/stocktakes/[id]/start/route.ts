import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

type Params = { params: Promise<{ id: string }> }

/** CHỐT SỔ và bắt đầu đếm. Mốc lấy giờ server, không nhận từ client. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await stocktakesService.startCounting(user, id))
})
