import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { cutPlanFromProductQuerySchema } from '@/modules/dept/production/cut-plan.schema'
import { cutPlanService } from '@/modules/dept/production/cut-plan.service'

/** Định mức của một hồ sơ SP × số lượng đợt → dòng quy cắt đã gom quy cách. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), cutPlanFromProductQuerySchema)
  const data = await cutPlanService.fromProduct(user, q.product_id, q.qty)
  return NextResponse.json(data)
})
