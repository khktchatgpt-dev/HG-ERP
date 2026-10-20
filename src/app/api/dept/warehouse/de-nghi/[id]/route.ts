import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiSaveSchema } from '@/modules/dept/warehouse/de-nghi.schema'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

type Params = { params: Promise<{ id: string }> }

/** Một phiếu đề nghị mua: xem (kèm tồn + giá gần nhất) · lưu nháp. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await deNghiService.get(user, id))
})

export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, deNghiSaveSchema)
  await deNghiService.save(user, id, input)
  return NextResponse.json({ ok: true })
})
