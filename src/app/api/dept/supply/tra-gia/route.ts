import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { traGiaService } from '@/modules/dept/supply/tra-gia.service'
import { traGiaSchema } from '@/modules/dept/supply/tra-gia.schema'

/**
 * Tra giá nhiều vật tư một lượt (màn Tra giá vật tư). POST vì danh sách có thể
 * tới 200 món — không nhét vừa query string. Chỉ đọc, không ghi gì.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, traGiaSchema)
  return NextResponse.json(await traGiaService.tra(user, input))
})
