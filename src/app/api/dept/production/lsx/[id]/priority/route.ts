import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { planService } from '@/modules/dept/production/plan.service'
import { prioritySchema } from '@/modules/dept/production/plan.schema'

type Params = { params: Promise<{ id: string }> }

/** Đặt ưu tiên lệnh (số lớn = làm trước) — vai Kế hoạch. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { priority } = await parseJson(req, prioritySchema)
  await planService.setPriority(user, id, priority)
  return NextResponse.json({ ok: true })
})
