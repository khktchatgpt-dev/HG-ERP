import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { dieuChinhService } from '@/modules/dept/hr/cham-cong/dieu-chinh.service'
import { dieuChinhQuyetSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Duyệt / từ chối / rút điều chỉnh đang chờ. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, dieuChinhQuyetSchema)
  const so = await dieuChinhService.quyet(user, v.ids, v.viec, v.ghiChu)
  return NextResponse.json({ so })
})
