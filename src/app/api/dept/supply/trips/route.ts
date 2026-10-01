import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tripsService } from '@/modules/dept/supply/trips.service'
import { tripInputSchema } from '@/modules/dept/supply/trips.schema'

/** Chuyến hàng (0216) gửi trong 60 ngày; `?mo=1` = chỉ chuyến còn theo dõi. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const openOnly = new URL(req.url).searchParams.get('mo') === '1'
  return NextResponse.json({ trips: await tripsService.list(user, { openOnly }) })
})

/** Ghi một chuyến hàng — hàng đã rời NCC. Không có tiền. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, tripInputSchema)
  return NextResponse.json({ trip: await tripsService.create(user, input) })
})
