import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { cachTinhService } from '@/modules/dept/hr/cham-cong/cach-tinh.service'
import { banApDungSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Áp dụng bản nháp từ một kỳ. */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const v = await parseJson(req, banApDungSchema)
    await cachTinhService.apDung(user, id, v.tuKy)
    return NextResponse.json({ ok: true })
  },
)
