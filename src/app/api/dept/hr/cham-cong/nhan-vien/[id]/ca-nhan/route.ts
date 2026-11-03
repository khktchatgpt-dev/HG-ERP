import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { caNhanSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Hiện số CCCD thật (ghi nhật ký người xem). Lưu thông tin cá nhân nay đi chung trang
 * Thông tin: POST [id]/thong-tin (B4, thay lưu theo khối).
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  await parseJson(req, caNhanSchema)
  return NextResponse.json({ gia: await hoSoNvService.hienCccd(user, id) })
})
