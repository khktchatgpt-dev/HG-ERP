import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService } from '@/modules/dept/sales/sales.service'
import { customerUpdateSchema } from '@/modules/dept/sales/sales.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, customerUpdateSchema)
  const customer = await salesService.update(user, id, input)
  return NextResponse.json({ customer })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await salesService.remove(user, id)
  return NextResponse.json({ ok: true })
})
