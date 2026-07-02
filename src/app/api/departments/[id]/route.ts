import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { departmentUpdateSchema } from '@/modules/core/departments/departments.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, departmentUpdateSchema)
  const department = await departmentsService.update(user, id, input)
  return NextResponse.json({ department })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await departmentsService.remove(user, id)
  return NextResponse.json({ ok: true })
})
