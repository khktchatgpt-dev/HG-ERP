import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { returnDocSchema } from '@/modules/dept/warehouse/warehouse.schema'

/** Lập phiếu trả hàng NCC (⑤, 0080): xuất trả gắn dòng PO, PO quay lại partial. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, returnDocSchema)
  const result = await stockService.createReturnDoc(user, input)
  return NextResponse.json(result, { status: 201 })
})
