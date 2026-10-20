import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { planCostService } from '@/modules/dept/technical/plan-cost.service'
import { planCostBulkSchema } from '@/modules/dept/technical/plan-cost.schema'

/** Nạp giá thành kế hoạch cho nhiều SP một lần (0220) — kiểm cả lô rồi mới ghi. */
export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, planCostBulkSchema)
  return NextResponse.json(await planCostService.save(user, input))
})
