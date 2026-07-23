import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import '@/events/register' // đăng ký handler audit RBAC (0075)
import { setRolePermissionsSchema } from '@/modules/core/rbac/rbac.schema'

type Params = { params: Promise<{ id: string }> }

// Đặt lại toàn bộ quyền của 1 vai (admin-only). Body: { permission_keys: [...] }.
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { permission_keys } = await parseJson(req, setRolePermissionsSchema)
  await rbacService.setRolePermissions(user, id, permission_keys)
  return NextResponse.json({ ok: true })
})
