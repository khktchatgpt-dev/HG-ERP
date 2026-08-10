import { NextResponse } from 'next/server'
import { handle, BadRequest } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quoteImportService } from '@/modules/dept/sales/quote-import.service'
import { maxBytesFor, formatBytes } from '@/modules/core/files/files.schema'

/**
 * NHỊP 1 của nhập báo giá từ Excel: đọc file, khớp sản phẩm, trả về để soi.
 * Không tạo sản phẩm, không tạo báo giá — chỉ lưu lại chính file nguồn.
 *
 * Nhận multipart (không phải JSON) nên không dùng `parseJson` như route khác.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw BadRequest('Thiếu file')

  const max = maxBytesFor(null)
  if (file.size > max) {
    throw BadRequest(`File ${formatBytes(file.size)} vượt giới hạn ${formatBytes(max)}`)
  }
  if (!/\.xlsx$/i.test(file.name)) {
    throw BadRequest('Chỉ nhận file .xlsx (Excel) — .xls cũ hãy lưu lại thành .xlsx')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const preview = await quoteImportService.preview(user, buffer, file.name)
  return NextResponse.json(preview)
})
