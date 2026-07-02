import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { handle } from '@/server/http'

export const GET = handle(async () => {
  const user = await authService.currentUser()
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user })
})
