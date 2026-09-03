import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialGroupsService } from '@/modules/dept/warehouse/material-groups.service'
import { materialGroupCreateSchema } from '@/modules/dept/warehouse/material-groups.schema'

/** Nhóm vật tư — tổng quan (GET) + thêm nhóm chính (POST). Quyền ở service. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await materialGroupsService.overview(user))
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { name } = await parseJson(req, materialGroupCreateSchema)
  const item = await materialGroupsService.create(user, name)
  return NextResponse.json(item, { status: 201 })
})
