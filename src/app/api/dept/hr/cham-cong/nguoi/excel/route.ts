import { handle, parseQuery } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { motNguoiQuerySchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { buildMotNguoiExcel } from '@/modules/dept/hr/cham-cong/mot-nguoi-excel'
import { todayVn } from '@/lib/date-vn'
import { khoangNgayTenFile, tenFileXuat } from '@/lib/ten-file-xuat'

/** Excel tờ "Chi tiết" chấm công một người — đúng khoảng và đúng số trang đang bày. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ma, tu, den } = parseQuery(new URL(req.url), motNguoiQuerySchema)
  const [mot, tinh] = await Promise.all([
    chamCongService.motNguoi(user, ma, { tu, den }),
    gioCongService.chiTietNguoi(user, ma, { tu, den }, todayVn()),
  ])
  return xlsxResponse(
    await buildMotNguoiExcel({ ...mot, tinh }),
    tenFileXuat('Chấm công', `${ma} ${mot.nguoi.ten}`, khoangNgayTenFile(tu, den)),
  )
})
