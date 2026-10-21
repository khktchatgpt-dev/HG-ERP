import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { toolRecallSchema } from '@/modules/core/assets/assets.schema'

/** Thu hồi dụng cụ về kho (mỗi người giữ một phiếu TH). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  return NextResponse.json(
    await assetsService.recall(user, await parseJson(req, toolRecallSchema)),
  )
})
