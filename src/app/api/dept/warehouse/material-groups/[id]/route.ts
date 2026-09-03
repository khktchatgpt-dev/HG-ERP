import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialGroupsService } from '@/modules/dept/warehouse/material-groups.service'
import { materialGroupUpdateSchema } from '@/modules/dept/warehouse/material-groups.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Đổi tên (lan xuống mọi vật tư) / bật–ngừng nhóm chính. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await params
  const patch = await parseJson(req, materialGroupUpdateSchema)
  let moved = 0
  let item = null
  if (patch.name !== undefined) {
    const r = await materialGroupsService.rename(user, id, patch.name)
    item = r.item
    moved = r.moved
  }
  if (patch.is_active !== undefined) {
    item = await materialGroupsService.setActive(user, id, patch.is_active)
  }
  return NextResponse.json({ item, moved })
})

/** Xoá hẳn — chỉ khi nhóm không còn mã nào (service chặn). */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await params
  await materialGroupsService.remove(user, id)
  return NextResponse.json({ ok: true })
})
