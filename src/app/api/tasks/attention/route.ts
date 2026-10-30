import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'

/**
 * SỐ ĐỎ "Phân công việc" của người đang đăng nhập:
 * `{ to_approve, my_overdue, total }` — việc chờ tôi duyệt + việc của tôi quá hạn.
 */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await tasksService.attention(user))
})
