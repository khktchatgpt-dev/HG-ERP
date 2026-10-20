import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tripsService } from '@/modules/dept/supply/trips.service'
import { tripInputSchema } from '@/modules/dept/supply/trips.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa chuyến hàng: thông tin xe + bộ đơn (gửi CẢ bộ đơn mới). */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, tripInputSchema)
  return NextResponse.json({ trip: await tripsService.update(user, id, input) })
})
