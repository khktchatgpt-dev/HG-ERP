import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { receiptDocSchema } from '@/modules/dept/warehouse/warehouse.schema'

/** Lập phiếu nhập kho nhiều dòng (PNK — FR-WMS-02/03/04). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, receiptDocSchema)
  const result = await stockService.createReceiptDoc(user, input)
  return NextResponse.json(result, { status: 201 })
})
