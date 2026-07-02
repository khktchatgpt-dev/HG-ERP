import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { parseJson } from '@/server/http'
import { taskRejectSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, taskRejectSchema)
  const task = await tasksService.reject(user, id, reason)
  return NextResponse.json({ task })
})
