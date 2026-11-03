import { handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { buildDsCnv } from '@/modules/dept/hr/cham-cong/ds-cnv-excel'
import { todayVn } from '@/lib/date-vn'

/** Danh sách CNV đúng mẫu file Nhân sự (Hồ sơ nhân viên B5) — nhóm bộ phận + sheet Đã nghỉ. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return xlsxResponse(await buildDsCnv(user), `danh-sach-cnv_${todayVn()}.xlsx`)
})
