import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { bienDongService } from '@/modules/dept/hr/cham-cong/bien-dong.service'
import { bienDongSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Vết biến động của một người (mới nhất trước). */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  return NextResponse.json({ ds: await bienDongService.lichSu(user, id) })
})

/** Ghi một biến động: ngày vào · cho nghỉ · huỷ cho nghỉ · đi làm lại · chuyển (0248). */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  const v = await parseJson(req, bienDongSchema)
  const s = bienDongService
  switch (v.viec) {
    case 'ngay_vao':
      await s.datNgayVao(user, id, v.ngay)
      return NextResponse.json({ ok: true })
    case 'nghi':
      return NextResponse.json(await s.choNghi(user, id, v))
    case 'huy_nghi':
      await s.huyNghi(user, id)
      return NextResponse.json({ ok: true })
    case 'lam_lai':
      await s.diLamLai(user, id, v)
      return NextResponse.json({ ok: true })
    case 'chuyen':
      await s.chuyen(user, id, v)
      return NextResponse.json({ ok: true })
  }
})
