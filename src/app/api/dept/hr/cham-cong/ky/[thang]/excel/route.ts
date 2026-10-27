import { BadRequest, handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { buildKyCongExcel } from '@/modules/dept/hr/cham-cong/ky-cong-excel'
import { kyThangSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { todayVn } from '@/lib/date-vn'
import { khoangNgayTenFile, tenFileXuat } from '@/lib/ten-file-xuat'

/** Excel kỳ công: cả kỳ (Kế toán) hoặc `?to=` một tổ (phiếu xác nhận công để ký). */
export const GET = handle(
  async (req: Request, ctx: { params: Promise<{ thang: string }> }) => {
    const user = await authService.requireUser()
    const t = kyThangSchema.safeParse((await ctx.params).thang)
    if (!t.success) throw BadRequest('Kỳ phải dạng YYYY-MM')
    const to = new URL(req.url).searchParams.get('to')?.trim() || undefined
    const g = await gioCongService.bang(user, t.data, todayVn())
    return xlsxResponse(
      await buildKyCongExcel(g, to),
      tenFileXuat(
        to ? 'Phiếu xác nhận công' : 'Kỳ công',
        to,
        khoangNgayTenFile(g.tu, g.den),
      ),
    )
  },
)
