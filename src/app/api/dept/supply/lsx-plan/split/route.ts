import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxPlanService } from '@/modules/dept/supply/lsx-plan.service'
import { planSplitSchema } from '@/modules/dept/supply/lsx-plan.schema'

/**
 * TÁCH ĐƠN THEO NCC: bảng kê của lệnh → mỗi nhà cung cấp một đơn đặt.
 * Trả danh sách đơn vừa tạo để màn hình hiện ngay ("đã tạo 8 đơn").
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, planSplitSchema)
  return NextResponse.json({ created: await lsxPlanService.split(user, input) })
})
