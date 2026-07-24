import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'

/** Toàn cảnh xưởng: lệnh đang chạy × công đoạn + tải việc theo tổ. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const data = await jobsService.overview(user)
  return NextResponse.json(data)
})
