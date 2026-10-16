import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { motNguoiQuerySchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Chấm công MỘT người theo khoảng ngày — mọi ngày, kể cả ngày không quẹt. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ma, tu, den } = parseQuery(new URL(req.url), motNguoiQuerySchema)
  return NextResponse.json(await chamCongService.motNguoi(user, ma, { tu, den }))
})
