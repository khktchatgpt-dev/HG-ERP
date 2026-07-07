import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const result = await productionService.detail(user, id)
  return NextResponse.json(result)
})
