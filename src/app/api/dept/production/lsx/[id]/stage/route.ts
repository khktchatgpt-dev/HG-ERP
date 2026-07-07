import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import { stageUpdateSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Cập nhật giai đoạn SX (FR-PROD-01, FR-SUP-08). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, stageUpdateSchema)
  const lsx = await productionService.updateStage(user, id, input)
  return NextResponse.json({ lsx })
})
