import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxPlanService } from '@/modules/dept/supply/lsx-plan.service'
import {
  planAssignSchema,
  planImportSchema,
  planListQuerySchema,
} from '@/modules/dept/supply/lsx-plan.schema'

/** Bảng kê vật tư của một LSX (BKVT) — nguồn để tách đơn theo NCC. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { production_order_id } = parseQuery(new URL(req.url), planListQuerySchema)
  return NextResponse.json({
    rows: await lsxPlanService.list(user, production_order_id),
  })
})

/** Nạp bảng kê (từ file LSX hoặc từ định mức). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, planImportSchema)
  return NextResponse.json(await lsxPlanService.importRows(user, input))
})

/** Gán NCC / sửa số hàng loạt. */
export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, planAssignSchema)
  return NextResponse.json({ updated: await lsxPlanService.assign(user, input) })
})
