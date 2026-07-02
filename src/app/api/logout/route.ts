import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { handle } from '@/server/http'

export const POST = handle(async () => {
  await authService.logout()
  return NextResponse.json({ ok: true })
})
