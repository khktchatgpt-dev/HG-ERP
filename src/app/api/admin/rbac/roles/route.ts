import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import '@/events/register' // đăng ký handler audit RBAC (0075)
import { roleCreateSchema } from '@/modules/core/rbac/rbac.schema'

// Tạo vai mới (admin-only). IT tự phục vụ ở /admin/permissions.
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, roleCreateSchema)
  const role = await rbacService.createRole(user, input)
  return NextResponse.json({ role }, { status: 201 })
})
