import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { poCostCarrierSchema } from '@/modules/dept/supply/po-costs.schema'

/** Nhà xe trong danh mục NCC (loại "Vận chuyển"). */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json({ carriers: await poCostsService.carriers(user) })
})

/** Thêm nhà xe mới ngay trong hộp ghi phí; trùng tên thì trả nhà xe có sẵn. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, poCostCarrierSchema)
  return NextResponse.json({ carrier: await poCostsService.addCarrier(user, input) }, { status: 201 })
})
