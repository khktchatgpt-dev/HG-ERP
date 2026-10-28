import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { traGiaService } from '@/modules/dept/supply/tra-gia.service'
import { traGiaExcelSchema } from '@/modules/dept/supply/tra-gia.schema'

/**
 * Xuất bảng so sánh giá (.xlsx) cho danh sách đang tra. Nhận chữ món + lựa chọn
 * của người mua, TRA LẠI giá ở server rồi mới ghi file. Chỉ đọc, không ghi DB.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, traGiaExcelSchema)
  const { buf, filename } = await traGiaService.excel(user, input)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
