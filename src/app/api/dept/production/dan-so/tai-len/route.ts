import { NextResponse } from 'next/server'
import { handle, BadRequest } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { danSoService } from '@/modules/dept/production/dan-so.service'
import { vnTodayIso } from '@/lib/local-date'

/**
 * Tải FILE MẪU đã điền lên (bản vẽ v2, 19/11/2026): chỉ ĐỌC và trả từng tờ dưới dạng dữ liệu xem
 * trước — chưa ghi gì. Ghi đi qua /api/dept/production/dan-so như dán tờ (từng đợt 10 ngày).
 */
export const maxDuration = 60
const TOI_DA = 12 * 1024 * 1024

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) throw BadRequest('Chưa chọn file')
  if (file.size > TOI_DA) throw BadRequest('File quá lớn (tối đa 12 MB)')
  if (!/\.xlsx$/i.test(file.name)) throw BadRequest('Chỉ nhận file .xlsx')
  const nam = Number(vnTodayIso().slice(0, 4))
  const buf = Buffer.from(await file.arrayBuffer())
  return NextResponse.json(await danSoService.taiLen(user, buf, nam))
})
