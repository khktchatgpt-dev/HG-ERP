import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { toolGiveSchema } from '@/modules/core/assets/assets.schema'

/** Giao dụng cụ trong kho cho một nhân viên (phiếu CP). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  return NextResponse.json(
    await assetsService.give(user, await parseJson(req, toolGiveSchema)),
  )
})
