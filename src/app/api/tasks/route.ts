import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { taskCreateSchema, taskListQuerySchema } from '@/modules/workflow/tasks/tasks.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), taskListQuerySchema)
  const result = await tasksService.list(user, q)
  return NextResponse.json(result)
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, taskCreateSchema)
  const task = await tasksService.create(user, input)
  return NextResponse.json({ task }, { status: 201 })
})
