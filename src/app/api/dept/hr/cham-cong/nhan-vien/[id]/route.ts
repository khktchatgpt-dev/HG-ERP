import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { nhanVienSuaSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Sửa họ tên / bộ phận / ca / tình trạng một nhân viên chấm công. */
export const PATCH = handle(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await ctx.params
    const v = await parseJson(req, nhanVienSuaSchema)
    await chamCongService.suaNhanVien(user, id, v)
    return NextResponse.json({ ok: true })
  },
)
