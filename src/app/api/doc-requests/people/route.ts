import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docRequestsService } from '@/modules/core/doc-notes/doc-requests.service'

/**
 * NGƯỜI NHẬN được yêu cầu việc (0281, C1 — mọi phòng): tên + phòng của mọi tài
 * khoản đang hoạt động. Mở cho mọi người đã đăng nhập vì ai xem được chứng từ thì
 * giao được (C5); `/api/users` thì chỉ trưởng phòng / admin đọc được nên không dùng.
 */
export const GET = handle(async () => {
  await authService.requireUser()
  return NextResponse.json({ people: await docRequestsService.people() })
})
