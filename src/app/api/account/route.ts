import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { accountService } from '@/modules/core/account/account.service'
import { accountProfileSchema } from '@/modules/core/account/account.schema'
import { handle, parseJson } from '@/server/http'

export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await accountService.getProfile(user))
})

export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, accountProfileSchema)
  return NextResponse.json({ user: await accountService.updateProfile(user, input) })
})
