import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { taskSubmitSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

/** Báo hoàn thành — `{ result }` bắt buộc (một câu kết quả cho người giao duyệt). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { result } = await parseJson(req, taskSubmitSchema)
  const task = await tasksService.submit(user, id, result)
  return NextResponse.json({ task })
})
