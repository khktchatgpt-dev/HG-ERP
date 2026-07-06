import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialUpdateSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, materialUpdateSchema)
  const material = await materialsService.update(user, id, input)
  return NextResponse.json({ material })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await materialsService.remove(user, id)
  return NextResponse.json({ ok: true })
})
