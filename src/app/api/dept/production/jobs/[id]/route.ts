import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { jobsService } from '@/modules/dept/production/jobs.service'
import { planService } from '@/modules/dept/production/plan.service'
import { jobPatchSchema } from '@/modules/dept/production/plan.schema'

type Params = { params: Promise<{ id: string }> }

const actionSchema = z.union([
  z.object({ action: z.literal('start') }),
  z.object({
    action: z.literal('confirm'),
    override: z.boolean().default(false),
    note: z.string().trim().max(1000).optional().nullable(),
  }),
  z.object({
    action: z.literal('note'),
    note: z.string().trim().max(1000).nullable(),
  }),
  z.object({ action: z.literal('plan') }).and(jobPatchSchema),
])

/**
 * Thao tác trên 1 công việc (LSX × dòng SP × công đoạn):
 *  - start:   tổ đánh dấu bắt đầu
 *  - confirm: tổ trưởng xác nhận XONG — service CHẶN khi số chưa đủ
 *  - note:    sửa ghi chú
 *  - plan:    Kế hoạch/quản đốc sửa giao tổ / hạn
 */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, actionSchema)
  if (input.action === 'start') {
    return NextResponse.json({ job: await jobsService.start(user, id) })
  }
  if (input.action === 'confirm') {
    const job = await jobsService.confirmDone(user, id, {
      override: input.override,
      note: input.note ?? null,
    })
    return NextResponse.json({ job })
  }
  if (input.action === 'note') {
    return NextResponse.json({
      job: await jobsService.updateNote(user, id, input.note),
    })
  }
  const { action: _action, ...patch } = input
  void _action
  return NextResponse.json({ job: await planService.patchJob(user, id, patch) })
})
