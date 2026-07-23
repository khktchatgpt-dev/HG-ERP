import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { rbacService } from '@/modules/core/rbac/rbac.service'
import '@/events/register' // đăng ký handler audit RBAC (0075)
import { setUserRolesSchema } from '@/modules/core/rbac/rbac.schema'

type Params = { params: Promise<{ id: string }> }

// Đặt lại các vai GÁN-TAY của 1 user (admin-only). Vai dẫn-xuất do sync quản lý.
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { role_ids } = await parseJson(req, setUserRolesSchema)
  await rbacService.setUserManualRoles(user, id, role_ids)
  return NextResponse.json({ ok: true })
})
