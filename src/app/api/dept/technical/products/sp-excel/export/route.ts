import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { spExcelService } from '@/modules/dept/technical/sp-excel.service'
import { spExcelExportQuerySchema } from '@/modules/dept/technical/sp-excel.schema'

export const maxDuration = 120

/**
 * Xuất file Excel SP: `?blank=1` mẫu trống · `?lsx=<mã lệnh>` SP của lệnh · còn
 * lại là bộ lọc thư viện. Trả 302 sang URL ký của Storage (file kèm ảnh lớn hơn
 * trần thân phản hồi), nên dùng thẳng làm `href`.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), spExcelExportQuerySchema)
  const { url } = await spExcelService.exportToStorage(user, q)
  return NextResponse.redirect(url, 302)
})
