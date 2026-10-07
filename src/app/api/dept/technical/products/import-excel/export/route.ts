import { handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import {
  libraryFilterFromParams,
  productImportService,
} from '@/modules/dept/technical/product-import.service'

export const maxDuration = 60

/**
 * Xuất SP ra Excel để sửa — nhận đúng tham số lọc của /products (q, customer,
 * type…); không tham số = cả thư viện.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const sp = new URL(req.url).searchParams
  const filter = libraryFilterFromParams(sp)
  const { buffer } = await productImportService.exportFile(user, filter)
  const day = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-') // prettier-ignore
  const who = filter.customer_name
    ? `_${filter.customer_name.replace(/[^\p{L}\p{N}]+/gu, '-')}`
    : ''
  return xlsxResponse(buffer, `San-pham${who}_${day}.xlsx`)
})
