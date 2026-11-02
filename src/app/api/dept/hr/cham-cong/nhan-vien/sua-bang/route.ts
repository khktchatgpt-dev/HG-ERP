import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { napHoSoService } from '@/modules/dept/hr/cham-cong/nap-ho-so.service'
import { suaBangSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Sửa trên bảng (Hồ sơ nhân viên B2): lưu các ô đã đổi qua đường nạp hồ sơ. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, suaBangSchema)
  return NextResponse.json(await napHoSoService.ghiBang(user, v.dong))
})
