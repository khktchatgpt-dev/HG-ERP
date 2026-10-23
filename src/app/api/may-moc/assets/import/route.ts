import { NextResponse } from 'next/server'
import { BadRequest, handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'

/**
 * Nhập danh sách máy từ Excel. `?commit=1` mới ghi; không có thì chỉ xem trước.
 * Có dòng lỗi thì KHÔNG ghi dòng nào (xem assetsService.importExcel).
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) throw BadRequest('Chọn file Excel (.xlsx)')
  if (!/\.xlsx$/i.test(file.name))
    throw BadRequest('Chỉ nhận file .xlsx — file .xls đời cũ hãy lưu lại thành .xlsx')
  if (file.size > 5 * 1024 * 1024) throw BadRequest('File quá 5 MB')
  const commit = new URL(req.url).searchParams.get('commit') === '1'
  return NextResponse.json(
    await assetsService.importExcel(user, await file.arrayBuffer(), commit),
  )
})
