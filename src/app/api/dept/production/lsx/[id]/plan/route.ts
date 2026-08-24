import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { linePlanSchema, lsxPlanSchema } from '@/modules/dept/production/plan.schema'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

/** Kế hoạch SX của lệnh: dòng SP × lộ trình (jobs) + tổ + hạn — mọi NV đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await planService.get(user, id)
  return NextResponse.json(data)
})

/**
 * Ghi kế hoạch — vai Kế hoạch. Hai dạng body:
 *  - { scope: 'lsx', stages, reason }  → CẢ LỆNH, rải xuống từng dòng SP
 *  - { order_line_id, stages, ... }    → tinh chỉnh 1 dòng SP
 */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, z.union([lsxPlanSchema, linePlanSchema]))
  if ('scope' in input) {
    const r = await planService.saveLsxPlan(user, id, input)
    return NextResponse.json({ ok: true, ...r })
  }
  await planService.saveLinePlan(user, id, input)
  return NextResponse.json({ ok: true })
})
