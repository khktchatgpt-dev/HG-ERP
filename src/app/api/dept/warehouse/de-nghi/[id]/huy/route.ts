import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiCancelSchema } from '@/modules/dept/warehouse/de-nghi.schema'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

type Params = { params: Promise<{ id: string }> }

/** Huỷ phiếu nháp / chờ duyệt — bắt lý do, không xoá. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, deNghiCancelSchema)
  await deNghiService.cancel(user, id, reason)
  return NextResponse.json({ ok: true })
})
