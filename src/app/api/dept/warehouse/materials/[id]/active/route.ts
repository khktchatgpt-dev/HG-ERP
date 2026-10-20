import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialActiveSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

/** Ngừng dùng (bắt lý do) / dùng lại một mã vật tư. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, materialActiveSchema)
  const material = await materialsService.setActive(user, id, input)
  return NextResponse.json({ material })
})
