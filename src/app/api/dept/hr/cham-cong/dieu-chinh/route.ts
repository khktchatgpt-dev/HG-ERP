import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { dieuChinhService } from '@/modules/dept/hr/cham-cong/dieu-chinh.service'
import { dieuChinhGuiSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Gửi một điều chỉnh chấm công (chờ duyệt). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const v = await parseJson(req, dieuChinhGuiSchema)
  const id = await dieuChinhService.gui(user, v)
  return NextResponse.json({ id })
})
