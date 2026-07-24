import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { linePlanSchema } from '@/modules/dept/production/plan.schema'

type Params = { params: Promise<{ id: string }> }

/** Kế hoạch SX của lệnh: dòng SP × lộ trình (jobs) + tổ + hạn — mọi NV đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await planService.get(user, id)
  return NextResponse.json(data)
})

/** Ghi kế hoạch 1 dòng SP (lộ trình + giao tổ + hạn) — vai Kế hoạch. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, linePlanSchema)
  await planService.saveLinePlan(user, id, input)
  return NextResponse.json({ ok: true })
})
