import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poUpdateSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const result = await posService.detail(user, id)
  return NextResponse.json(result)
})

/** Sửa đơn — khi còn là nháp / chờ duyệt. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poUpdateSchema)
  const po = await posService.update(user, id, input)
  return NextResponse.json({ po })
})

/** Xoá hẳn — chỉ đơn NHÁP (0116); đơn đã gửi duyệt dùng /cancel. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await posService.remove(user, id)
  return NextResponse.json({ ok: true })
})
