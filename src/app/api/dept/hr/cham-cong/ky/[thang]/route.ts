import { NextResponse } from 'next/server'
import { BadRequest, handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { kyCongService } from '@/modules/dept/hr/cham-cong/ky-cong.service'
import { kyThangSchema, kyViecSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Chuyển tiếp của kỳ công: xác nhận / bỏ xác nhận tổ, chốt, xin · rút · duyệt mở lại. */
export const POST = handle(
  async (req: Request, ctx: { params: Promise<{ thang: string }> }) => {
    const user = await authService.requireUser()
    const t = kyThangSchema.safeParse((await ctx.params).thang)
    if (!t.success) throw BadRequest('Kỳ phải dạng YYYY-MM')
    const thang = t.data
    const v = await parseJson(req, kyViecSchema)
    switch (v.viec) {
      case 'xac_nhan':
        await kyCongService.xacNhanTo(user, thang, v.to, v.dongY0)
        break
      case 'bo_xac_nhan':
        await kyCongService.boXacNhanTo(user, thang, v.to)
        break
      case 'chot':
        return NextResponse.json(await kyCongService.chot(user, thang))
      case 'xin_mo':
        await kyCongService.xinMoLai(user, thang, v.lyDo)
        break
      case 'rut_xin':
        await kyCongService.rutXin(user, thang)
        break
      case 'quyet_mo':
        await kyCongService.quyetMoLai(user, thang, v.dongY, v.ghiChu)
        break
    }
    return NextResponse.json({ ok: true })
  },
)
