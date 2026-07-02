import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { departmentsService } from '@/modules/core/departments/departments.service'
import { parseJson } from '@/server/http'
import { departmentCreateSchema } from '@/modules/core/departments/departments.schema'

export const GET = handle(async () => {
  await authService.requireUser()
  return NextResponse.json({ departments: await departmentsService.list() })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, departmentCreateSchema)
  const dept = await departmentsService.create(user, input)
  return NextResponse.json({ department: dept }, { status: 201 })
})
