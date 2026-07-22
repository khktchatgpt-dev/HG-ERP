import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { pricesService } from '@/modules/dept/supply/prices.service'
import { priceBulkCreateSchema } from '@/modules/dept/supply/prices.schema'

/** Nhập báo giá NCC hàng loạt (FR-SUP-06): 1 NCC × nhiều dòng × 1 ngày hiệu lực. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, priceBulkCreateSchema)
  const result = await pricesService.bulkCreate(user, input)
  return NextResponse.json(result, { status: 201 })
})
