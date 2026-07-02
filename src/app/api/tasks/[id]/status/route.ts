import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { parseJson } from '@/server/http'
import { taskStatusSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { status } = await parseJson(req, taskStatusSchema)
  const task = await tasksService.changeStatus(user, id, status)
  return NextResponse.json({ task })
})
