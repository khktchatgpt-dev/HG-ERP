import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiNhapSchema } from '@/modules/dept/warehouse/de-nghi.schema'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

type Params = { params: Promise<{ id: string }> }

/** Kho nhập hàng đã mua theo phiếu đề nghị (0238 · Đ3) — ghi một PNK có đơn giá thật. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, deNghiNhapSchema)
  return NextResponse.json(await deNghiService.nhapKho(user, id, input))
})
