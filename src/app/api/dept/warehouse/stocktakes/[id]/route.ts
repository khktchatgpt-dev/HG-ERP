import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'

type Params = { params: Promise<{ id: string }> }

/** Một đợt + dòng đếm. Số sổ bị GIẤU nếu đợt đang đếm mù — xem service. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await stocktakesService.detail(user, id))
})
