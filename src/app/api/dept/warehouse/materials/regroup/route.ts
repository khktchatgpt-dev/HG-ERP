import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialRegroupSchema } from '@/modules/dept/warehouse/warehouse.schema'

/**
 * ĐỔI NHÓM / NHÓM PHỤ HÀNG LOẠT cho các mã đã tích ở màn danh mục (03/09/2026).
 *
 * Trước đây sửa nhóm cho 149 mã lạc là 149 lượt ⋯ → Sửa → Lưu. Nhóm là text
 * (free-text-over-fk) nên khoá theo tên, không FK; luật nghiệp vụ nằm ở service.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, materialRegroupSchema)
  const out = await materialsService.regroup(user, input)
  return NextResponse.json(out)
})
