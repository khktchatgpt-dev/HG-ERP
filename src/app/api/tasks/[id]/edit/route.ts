import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { taskEditSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa việc đã giao (người giao / sếp). Trả cả các dòng "đã đổi gì" để màn báo lại. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, taskEditSchema)
  const { task, changes } = await tasksService.edit(user, id, input)
  return NextResponse.json({ task, changes })
})
