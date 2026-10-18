import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { cachTinhService } from '@/modules/dept/hr/cham-cong/cach-tinh.service'

/** Rút bản đã áp dụng (từ kỳ đang mở trở đi) về nháp. */
export const POST = handle(
  async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    await cachTinhService.rutVeNhap(user, id)
    return NextResponse.json({ ok: true })
  },
)
