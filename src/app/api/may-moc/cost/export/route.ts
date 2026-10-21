import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { costQuerySchema } from '@/modules/core/assets/assets.schema'
import { xlsx } from '../../_xlsx'

/** Bảng chi phí bảo trì một tháng (.xlsx) cho kế toán đưa vào MISA. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ym } = parseQuery(new URL(req.url), costQuerySchema)
  const { month, buffer } = await assetsService.costExcel(user, ym)
  return xlsx(buffer, `Chi-phi-bao-tri-${month}.xlsx`)
})
