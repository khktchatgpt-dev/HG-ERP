import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'

export const GET = handle(async () => {
  const user = await authService.requireUser()
  const stats = await tasksService.dashboard(user)
  return NextResponse.json({ user, stats })
})
