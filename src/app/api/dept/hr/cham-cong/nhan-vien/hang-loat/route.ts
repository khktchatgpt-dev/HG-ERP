import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { nhanVienHangLoatSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Đổi ca và/hoặc bộ phận cho nhiều nhân viên một lần. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, nhanVienHangLoatSchema)
  return NextResponse.json(await chamCongService.doiHangLoat(user, v))
})
