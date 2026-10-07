import { handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'

/** File mẫu TRỐNG — chỉ để thêm SP mới (sửa SP có sẵn thì dùng /export). */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const { buffer } = await productImportService.exportFile(user, null)
  return xlsxResponse(buffer, 'Mau-them-san-pham.xlsx')
})
