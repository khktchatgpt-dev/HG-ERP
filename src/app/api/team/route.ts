import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { teamService } from '@/modules/workflow/team/team.service'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const url = new URL(req.url)
  const deptId = url.searchParams.get('dept') ?? undefined
  const data = await teamService.dashboard(user, deptId)
  return NextResponse.json(data)
})
