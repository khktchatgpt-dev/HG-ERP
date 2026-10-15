import { handle, parseQuery } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { keoSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { buildDuLieuExcel } from '@/modules/dept/hr/cham-cong/du-lieu-excel'

/** Excel lượt thô của khoảng ngày — cùng dữ liệu trang Lấy dữ liệu đang bày. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const k = parseQuery(new URL(req.url), keoSchema)
  const buf = await buildDuLieuExcel(await chamCongService.duLieu(user, k))
  return xlsxResponse(buf, `luot-quet_${k.tu}_${k.den}.xlsx`)
})
