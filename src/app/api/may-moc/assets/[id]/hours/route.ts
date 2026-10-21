import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { hoursSchema } from '@/modules/core/assets/assets.schema'

type Params = { params: Promise<{ id: string }> }

/** Cập nhật số đọc đồng hồ giờ chạy — lịch theo giờ chạy tự tính lại. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { hours } = await parseJson(req, hoursSchema)
  return NextResponse.json({ asset: await assetsService.setHours(user, id, hours) })
})
