import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { binsService } from '@/modules/dept/warehouse/stock.service'
import { binCreateSchema } from '@/modules/dept/warehouse/warehouse.schema'

export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json({ rows: await binsService.list(user) })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const body = await parseJson(req, binCreateSchema)
  return NextResponse.json({ bin: await binsService.create(user, body) }, { status: 201 })
})
