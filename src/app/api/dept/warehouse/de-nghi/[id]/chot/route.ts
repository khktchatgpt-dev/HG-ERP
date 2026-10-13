import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiChotSchema } from '@/modules/dept/warehouse/de-nghi.schema'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

type Params = { params: Promise<{ id: string }> }

/** Chốt xong phiếu còn dòng thiếu mà không mua nữa (0238 · Q14) — bắt lý do. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, deNghiChotSchema)
  await deNghiService.chot(user, id, reason)
  return NextResponse.json({ ok: true })
})
