import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({ note: z.string().trim().max(1000).optional().nullable() })

/** Báo hoàn thành LSX → đơn hàng sang 'completed' (FR-PROD-03). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { note } = await parseJson(req, bodySchema)
  const lsx = await productionService.complete(user, id, note)
  return NextResponse.json({ lsx })
})
