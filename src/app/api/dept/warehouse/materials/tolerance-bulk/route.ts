import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialToleranceBulkSchema } from '@/modules/dept/warehouse/warehouse.schema'

/**
 * Đặt DUNG SAI NHẬN VƯỢT cho cả nhóm vật tư (0156) — bulk từ màn danh mục.
 * Nhóm là text tự do (free-text-over-fk) nên khoá theo group_name, không FK.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { group_name, pct } = await parseJson(req, materialToleranceBulkSchema)
  const out = await materialsService.setGroupTolerance(user, group_name, pct)
  return NextResponse.json(out)
})
