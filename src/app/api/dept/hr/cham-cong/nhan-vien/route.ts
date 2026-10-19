import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { bienDongService } from '@/modules/dept/hr/cham-cong/bien-dong.service'
import { nhanVienTuyenSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Tuyển vào một nhân viên (0248) — tuỳ chọn ghép luôn một mã trên máy. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, nhanVienTuyenSchema)
  return NextResponse.json(await bienDongService.tuyenVao(user, v))
})
