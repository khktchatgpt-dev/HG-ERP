import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { weeklyReportQuerySchema } from '@/modules/workflow/tasks/tasks.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const opts = parseQuery(new URL(req.url), weeklyReportQuerySchema)
  const report = await tasksService.weeklyReport(user, opts)
  return NextResponse.json(report)
})
