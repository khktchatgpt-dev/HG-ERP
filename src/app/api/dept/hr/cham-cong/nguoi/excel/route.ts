import { handle, parseQuery } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { motNguoiQuerySchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { buildMotNguoiExcel } from '@/modules/dept/hr/cham-cong/mot-nguoi-excel'

/** Excel chấm công một người theo đúng khoảng đang xem trong ngăn kéo. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ma, tu, den } = parseQuery(new URL(req.url), motNguoiQuerySchema)
  const d = await chamCongService.motNguoi(user, ma, { tu, den })
  return xlsxResponse(await buildMotNguoiExcel(d), `cham-cong_${ma}_${tu}_${den}.xlsx`)
})
