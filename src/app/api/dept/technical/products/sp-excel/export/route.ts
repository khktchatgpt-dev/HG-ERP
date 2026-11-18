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
 *
 * `?json=1` (18/11/2026): trả `{ url, count }` thay vì 302 — nút Xuất gọi bằng
 * `api()` để bày "Đang tạo file…" và chặn bấm lại trong ~20 giây chờ (cả thư viện
 * kèm ảnh), thay cho link trần đứng im làm người dùng bấm nhiều lần.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const u = new URL(req.url)
  const q = parseQuery(u, spExcelExportQuerySchema)
  const { url, count } = await spExcelService.exportToStorage(user, q)
  if (u.searchParams.get('json') === '1') return NextResponse.json({ url, count })
  return NextResponse.redirect(url, 302)
})
