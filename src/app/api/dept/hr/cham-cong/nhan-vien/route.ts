import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { nhanVienThemSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Thêm một nhân viên chấm công (tuỳ chọn ghép luôn một mã trên máy). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, nhanVienThemSchema)
  return NextResponse.json(await chamCongService.themNhanVien(user, v))
})
