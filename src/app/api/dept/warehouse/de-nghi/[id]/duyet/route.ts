import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiDecideSchema } from '@/modules/dept/warehouse/de-nghi.schema'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

type Params = { params: Promise<{ id: string }> }

/** Lãnh đạo quyết đề nghị mua (Đ2): duyệt (kèm số duyệt từng dòng) / từ chối có lý do. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, deNghiDecideSchema)
  await deNghiService.decide(user, id, input)
  return NextResponse.json({ ok: true })
})
