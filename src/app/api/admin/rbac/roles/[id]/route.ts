import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import '@/events/register' // đăng ký handler audit RBAC (0075)
import { roleUpdateSchema } from '@/modules/core/rbac/rbac.schema'

type Params = { params: Promise<{ id: string }> }

// Sửa vai (nhãn/mô tả/thứ tự/kích hoạt). Admin-only; chặn vô hiệu hoá vai hệ thống.
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const patch = await parseJson(req, roleUpdateSchema)
  const role = await rbacService.updateRole(user, id, patch)
  return NextResponse.json({ role })
})
