import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { tasksService } from '@/modules/workflow/tasks/tasks.service'
import { taskApproveSchema } from '@/modules/workflow/tasks/tasks.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Người giao (hoặc sếp) duyệt Đạt — `{ note? }`. Thân rỗng vẫn nhận: màn cũ gọi
 * không gửi gì, và lời nhắn khi duyệt là tuỳ chọn.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const hasBody = (req.headers.get('content-length') ?? '0') !== '0'
  const { note } = hasBody ? await parseJson(req, taskApproveSchema) : { note: null }
  const task = await tasksService.approve(user, id, note)
  return NextResponse.json({ task })
})
