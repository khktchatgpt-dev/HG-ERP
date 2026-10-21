import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { planUpdateSchema } from '@/modules/core/assets/assets.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa chu kỳ / tên / chi phí dự kiến, tạm dừng hoặc bật lại một hạng mục. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json({
    plan: await assetsService.updatePlan(
      user,
      id,
      await parseJson(req, planUpdateSchema),
    ),
  })
})
