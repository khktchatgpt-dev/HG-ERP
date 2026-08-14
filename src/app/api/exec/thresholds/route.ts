import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { approvalThresholdsSchema } from '@/modules/core/settings/settings.schema'

/**
 * Đặt ngưỡng "giá trị lớn" khi ký, theo từng tiền tệ (/exec/luat-ky).
 *
 * Gác bằng `exec.threshold.manage` trong service — quyền của NGƯỜI KÝ, không
 * phải `system.settings.manage`: Giám đốc chỉnh được luật ký của mình mà không
 * cần chìa khoá cấu hình hệ thống.
 */
export const PUT = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { thresholds } = await parseJson(req, approvalThresholdsSchema)
  const saved = await settingsService.setApprovalThresholds(user, thresholds)
  return NextResponse.json({ thresholds: saved })
})
