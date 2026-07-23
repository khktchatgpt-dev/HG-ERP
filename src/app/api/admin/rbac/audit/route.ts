import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'

// Nhật ký audit thao tác phân quyền (admin-only).
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const entries = await rbacService.audit(user)
  return NextResponse.json({ entries })
})
