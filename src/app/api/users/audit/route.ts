import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { userAuditListSchema } from '@/modules/core/users/users.schema'

// Xem lịch sử admin thao tác trên user.
// Query: ?target_user_id=<uuid>&limit=50
export const GET = handle(async (req: Request) => {
  const actor = await authService.requireUser()
  const q = parseQuery(new URL(req.url), userAuditListSchema)
  const entries = await usersService.getAudit(actor, {
    target_user_id: q.target_user_id,
    limit: q.limit,
  })
  return NextResponse.json({ entries })
})
