import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'

/** Kiểm kết nối các máy chấm công: đọc serial + số lượt / sức chứa. Chỉ ĐỌC máy. */
export const POST = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json({ may: await chamCongService.kiemMay(user) })
})
