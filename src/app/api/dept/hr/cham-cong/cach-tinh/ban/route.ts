import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { cachTinhService } from '@/modules/dept/hr/cham-cong/cach-tinh.service'
import { banMoiSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Chép một bản cách tính thành bản nháp mới. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, banMoiSchema)
  return NextResponse.json(await cachTinhService.taoBan(user, v.tuBan))
})
