import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { keoSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

// Đọc hết log hai máy mất ~70 giây (máy .203 ~49 giây, đo 12/10/2026).
export const maxDuration = 300

/** Lấy lượt quẹt trong khoảng ngày từ mọi máy chấm công đang dùng. Chỉ ĐỌC máy. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const khoang = await parseJson(req, keoSchema)
  const result = await chamCongService.keoTuMay(user, khoang)
  return NextResponse.json(result)
})
