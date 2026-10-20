import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { shipPlanService } from '@/modules/dept/sales/ship-plan.service'
import { shipPlanSaveSchema } from '@/modules/dept/sales/ship-plan.schema'

type Params = { params: Promise<{ lsxId: string }> }

/**
 * Sale lưu kế hoạch xuất (chia đợt theo PO khách) của MỘT lệnh — thay cả bộ.
 * Không đụng dòng lệnh, không tạo bản chỉnh sửa lệnh (0222, 06/10/2026).
 */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { lsxId } = await params
  const input = await parseJson(req, shipPlanSaveSchema)
  await shipPlanService.save(user, lsxId, input)
  return NextResponse.json({ ok: true })
})
