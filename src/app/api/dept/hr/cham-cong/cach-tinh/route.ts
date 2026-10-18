import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { cachTinhSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Đổi cách tính giờ công (theo khung / theo ngày) của một bộ phận. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, cachTinhSchema)
  await gioCongService.ghiCachTinh(user, v.boPhan, v.cachTinh)
  return NextResponse.json({ ok: true })
})
