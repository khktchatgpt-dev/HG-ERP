import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { certsService } from '@/modules/dept/supply/certs.service'

type Params = { params: Promise<{ id: string }> }

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await certsService.remove(user, id)
  return NextResponse.json({ ok: true })
})
