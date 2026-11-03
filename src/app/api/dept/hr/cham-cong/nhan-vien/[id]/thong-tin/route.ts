import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { thongTinSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Lưu trang Thông tin của hồ sơ một người (B4) — công việc + cá nhân một lần, một vết. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  const v = await parseJson(req, thongTinSchema)
  return NextResponse.json(await hoSoNvService.luuThongTin(user, id, v))
})
