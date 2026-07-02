import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import {
  userDeleteSchema,
  userUpdateSchema,
} from '@/modules/core/users/users.schema'

type Params = { params: Promise<{ id: string }> }

// Update a user (admin only): role / department / title / active state.
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const actor = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, userUpdateSchema)
  const user = await usersService.update(actor, id, input)
  return NextResponse.json({ user })
})

// Soft-delete (admin only). Body: { reason?: string }
export const DELETE = handle(async (req: Request, { params }: Params) => {
  const actor = await authService.requireUser()
  const { id } = await params
  // Accept empty body — schema tolerates missing reason.
  let reason: string | undefined
  try {
    const body = await parseJson(req, userDeleteSchema)
    reason = body.reason
  } catch {
    /* no body is fine */
  }
  const user = await usersService.softDelete(actor, id, reason)
  return NextResponse.json({ user })
})
