import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { taskProgressSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { progress_percent } = await parseJson(req, taskProgressSchema)
  const task = await tasksService.setProgress(user, id, progress_percent)
  return NextResponse.json({ task })
})
