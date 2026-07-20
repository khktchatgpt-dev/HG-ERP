import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { incidentsService } from '@/modules/dept/production/incidents.service'

type Params = { params: Promise<{ id: string }> }

/** Quản đốc đóng sự cố — notify người báo qua event bus. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const incident = await incidentsService.resolve(user, id)
  return NextResponse.json({ incident })
})
