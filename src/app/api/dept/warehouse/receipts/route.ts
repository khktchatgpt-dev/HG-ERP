import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { receiptSchema } from '@/modules/dept/warehouse/warehouse.schema'

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, receiptSchema)
  const movement = await stockService.receive(user, input)
  return NextResponse.json({ movement }, { status: 201 })
})
