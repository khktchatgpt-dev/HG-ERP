import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { xlsx } from '../../_xlsx'

/** File mẫu Excel để Tổ Cơ điện điền danh sách máy. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return xlsx(await assetsService.template(user), 'Mau-danh-sach-may-moc.xlsx')
})
