import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hopDongService } from '@/modules/dept/hr/cham-cong/hop-dong.service'
import { hopDongSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Hợp đồng lao động của một người (0250): thêm / sửa / huỷ. Trả cảnh báo luật lao động. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  const v = await parseJson(req, hopDongSchema)
  if (v.viec === 'them') return NextResponse.json(await hopDongService.them(user, id, v.hd))
  if (v.viec === 'sua') return NextResponse.json(await hopDongService.sua(user, v.id, v.hd))
  await hopDongService.huy(user, v.id, v.lyDo)
  return NextResponse.json({ ok: true })
})
