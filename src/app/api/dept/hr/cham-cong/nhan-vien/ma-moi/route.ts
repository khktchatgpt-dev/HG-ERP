import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hoSoNvService } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { todayVn } from '@/lib/date-vn'

/** Mã đã quẹt máy 30 ngày mà chưa có hồ sơ — gợi ý cho hộp Tuyển vào (Hồ sơ nhân viên B3). */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await hoSoNvService.maMoi(user, todayVn()))
})
