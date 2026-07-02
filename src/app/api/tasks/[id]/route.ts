import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { parseJson } from '@/server/http'
import { taskUpdateSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const task = await tasksService.get(user, id)
  return NextResponse.json({ task })
})

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, taskUpdateSchema)
  const task = await tasksService.update(user, id, input)
  return NextResponse.json({ task })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await tasksService.remove(user, id)
  return NextResponse.json({ ok: true })
})
