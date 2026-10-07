import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productImportService } from '@/modules/dept/technical/product-import.service'
import { readXlsxUpload } from '../upload'

/** Soi trước file thêm SP hàng loạt — đọc + kiểm từng dòng, KHÔNG ghi gì. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const buffer = await readXlsxUpload(req)
  return NextResponse.json(await productImportService.preview(user, buffer))
})
