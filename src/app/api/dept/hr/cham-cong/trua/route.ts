import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { truaSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Ghi / bỏ tick làm trưa cho một hoặc nhiều người-ngày. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { muc } = await parseJson(req, truaSchema)
  return NextResponse.json({ so: await gioCongService.ghiTrua(user, muc) })
})
