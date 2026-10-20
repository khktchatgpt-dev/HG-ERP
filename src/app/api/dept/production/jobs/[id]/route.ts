import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { jobPatchSchema } from '@/modules/dept/production/plan.schema'

type Params = { params: Promise<{ id: string }> }

const actionSchema = z.object({ action: z.literal('plan') }).and(jobPatchSchema)

/**
 * Thao tác trên 1 công việc (LSX × dòng SP × công đoạn).
 *
 * CÒN ĐÚNG MỘT: `plan` — Kế hoạch/quản đốc sửa giao tổ / hạn.
 *
 * BA THAO TÁC CŨ ĐÃ GỠ 18/09/2026 (`start`, `confirm`, `note`): chúng là của
 * tổ trưởng, mà chủ dự án đã chốt "tổ trưởng chỉ xem để biết tình hình". Công
 * đoạn nay XONG KHI ĐỦ SỐ — `entriesService.record` tự nhích job sang `done`
 * khi sổ đạt tổng cần (xem `jobsRepo.markDone`). Bỏ luôn đường bấm tay là bỏ
 * luôn khả năng trạng thái lệch với sổ.
 */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { action: _action, ...patch } = await parseJson(req, actionSchema)
  void _action
  return NextResponse.json({ job: await planService.patchJob(user, id, patch) })
})
