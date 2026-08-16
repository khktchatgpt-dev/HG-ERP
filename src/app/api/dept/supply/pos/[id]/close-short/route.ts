import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCloseShortSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Chốt / mở lại PHẦN THIẾU của đơn (0154) — Cung ứng tuyên bố "phần còn lại
 * không về nữa" theo dòng hoặc cả đơn, kèm lý do. Sổ kho không đổi (BR-08);
 * chỉ cách tính "còn chờ về" (qty_open) đổi.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poCloseShortSchema)
  await posService.closeShort(user, id, input)
  return NextResponse.json({ ok: true })
})
