import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { readXlsxUpload } from './upload'

/** Tải file mẫu thêm SP hàng loạt. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const buf = await productImportService.template(user)
  return xlsxResponse(buf, 'Mau-nhap-san-pham.xlsx')
})

/** Thêm cả lô từ file đã điền — server soi lại từ đầu, còn dòng lỗi thì không thêm gì. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const buffer = await readXlsxUpload(req)
  const result = await productImportService.commit(user, buffer)
  return NextResponse.json(result, { status: 201 })
})
