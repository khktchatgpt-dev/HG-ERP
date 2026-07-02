import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { handle } from '@/server/http'
import { parseJson } from '@/server/http'
import { loginSchema } from '@/modules/core/auth/auth.schema'

export const POST = handle(async (req: Request) => {
  const input = await parseJson(req, loginSchema)
  const user = await authService.login(input)
  return NextResponse.json({ user })
})
