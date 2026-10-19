import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import type { CotCaNhan } from '@/modules/dept/hr/cham-cong/ca-nhan.repo'
import { caNhanSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Thông tin cá nhân (0249): lưu một khối, hoặc hiện số CCCD (ghi nhật ký người xem). */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  const v = await parseJson(req, caNhanSchema)
  if (v.viec === 'hien')
    return NextResponse.json({ gia: await hoSoNvService.hienCccd(user, id) })
  await hoSoNvService.luuCaNhan(
    user,
    id,
    v.khoi,
    v.gia as Partial<Record<CotCaNhan, string | null>>,
  )
  return NextResponse.json({ ok: true })
})
