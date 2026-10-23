import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { planDoneSchema } from '@/modules/core/assets/assets.schema'

type Params = { params: Promise<{ id: string }> }

/** "Đã làm": ghi phiếu bảo dưỡng / kiểm định, lịch dời sang kỳ sau. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const wo = await assetsService.planDone(user, id, await parseJson(req, planDoneSchema))
  return NextResponse.json({ work_order: wo }, { status: 201 })
})
