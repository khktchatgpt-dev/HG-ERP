import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { bangCongQuerySchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { thang } = parseQuery(new URL(req.url), bangCongQuerySchema)
  return NextResponse.json(await chamCongService.bangCong(user, thang))
})
