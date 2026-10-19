import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { buildBangToExcel } from '@/modules/dept/hr/cham-cong/bang-to-excel'
import { todayVn } from '@/lib/date-vn'

const q = z.object({
  thang: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Tháng phải dạng YYYY-MM'),
  to: z.string().trim().min(1, 'Thiếu tổ').max(120),
})

/** Excel Bảng chấm công theo tổ của một tháng — cùng lưới trang bày. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { thang, to } = parseQuery(new URL(req.url), q)
  const [y, m] = thang.split('-').map(Number)
  const den = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const d = await chamCongService.duLieu(user, { tu: `${thang}-01`, den })
  return xlsxResponse(
    await buildBangToExcel(d, to, todayVn()),
    `cham-cong-to_${thang}.xlsx`,
  )
})
