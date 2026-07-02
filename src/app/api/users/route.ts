import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { userCreateSchema, userListQuerySchema } from '@/modules/core/users/users.schema'

// List users — managers see their department; admins see all. Employees: 403.
export const GET = handle(async (req: Request) => {
  const actor = await authService.requireUser()
  const filter = parseQuery(new URL(req.url), userListQuerySchema)
  const users = await usersService.list(actor, filter)
  return NextResponse.json({ users })
})

// Create a user (admin only). Replaces public self-registration.
export const POST = handle(async (req: Request) => {
  const actor = await authService.requireUser()
  const input = await parseJson(req, userCreateSchema)
  const user = await usersService.create(actor, input)
  return NextResponse.json({ user }, { status: 201 })
})
