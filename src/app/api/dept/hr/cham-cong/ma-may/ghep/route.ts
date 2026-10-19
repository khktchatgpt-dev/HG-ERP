import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { ghepMaSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Ghép một mã trên máy vào nhân viên, hoặc gỡ ghép (`employee_id: null`). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, ghepMaSchema)
  await chamCongService.ghepMa(user, v)
  return NextResponse.json({ ok: true })
})
