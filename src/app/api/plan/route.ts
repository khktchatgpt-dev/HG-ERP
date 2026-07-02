import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { planQuerySchema } from '@/modules/workflow/tasks/tasks.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { range } = parseQuery(new URL(req.url), planQuerySchema)
  const tasks = await tasksService.myPlan(user, range)
  return NextResponse.json({ tasks })
})
