import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { parseJson } from '@/server/http'
import { commentCreateSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json({ comments: await tasksService.listComments(user, id) })
})

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, commentCreateSchema)
  await tasksService.addComment(user, id, input)
  return NextResponse.json({ ok: true }, { status: 201 })
})
