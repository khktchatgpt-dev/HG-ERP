import { BadRequest, handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { bangLuongService } from '@/modules/dept/hr/luong/bang-luong.service'
import { buildBangLuongExcel } from '@/modules/dept/hr/luong/bang-luong-excel'
import { kyThangSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

/** Excel bảng lương + tờ chuyển khoản của một kỳ. */
export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ thang: string }> }) => {
    const user = await authService.requireUser()
    const t = kyThangSchema.safeParse((await ctx.params).thang)
    if (!t.success) throw BadRequest('Kỳ phải dạng YYYY-MM')
    const b = await bangLuongService.trang(user, t.data)
    return xlsxResponse(await buildBangLuongExcel(b), `bang-luong_${t.data}.xlsx`)
  },
)
