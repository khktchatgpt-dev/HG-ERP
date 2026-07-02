import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'

type Params = { params: Promise<{ id: string }> }

// Restore một user đã soft-delete (admin only).
export const POST = handle(async (_req: Request, { params }: Params) => {
  const actor = await authService.requireUser()
  const { id } = await params
  const user = await usersService.restore(actor, id)
  return NextResponse.json({ user })
})
