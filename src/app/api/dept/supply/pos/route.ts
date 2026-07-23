import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema, poListQuerySchema } from '@/modules/dept/supply/pos.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), poListQuerySchema)
  const result = await posService.list(user, q)
  return NextResponse.json(result)
})

/** Tạo đơn đặt vật tư (1 NCC; gắn LSX hoặc ngoài LSX — 0076) → vào thẳng chờ GĐ duyệt. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, poCreateSchema)
  const po = await posService.create(user, input)
  return NextResponse.json({ po }, { status: 201 })
})
