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

/** Sửa đơn — chỉ khi đang chờ duyệt. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poUpdateSchema)
  const po = await posService.update(user, id, input)
  return NextResponse.json({ po })
})
