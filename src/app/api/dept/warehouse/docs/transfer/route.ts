import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { createTransferDoc } from '@/modules/dept/warehouse/stock.service'
import { transferDocSchema } from '@/modules/dept/warehouse/warehouse.schema'

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const body = await parseJson(req, transferDocSchema)
  const doc = await createTransferDoc(user, body)
  return NextResponse.json({ doc }, { status: 201 })
})
