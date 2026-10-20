import { handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { buildSoLaoDong } from '@/modules/dept/hr/cham-cong/so-lao-dong-excel'
import { todayVn } from '@/lib/date-vn'

/** Sổ quản lý lao động (B4) — cũng là mẫu để điền rồi dán lại ở "Nhập từ Excel". */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const { buf, rieng } = await buildSoLaoDong(user)
  return xlsxResponse(
    buf,
    `${rieng ? 'so-quan-ly-lao-dong' : 'danh-sach-nhan-vien'}_${todayVn()}.xlsx`,
  )
})
