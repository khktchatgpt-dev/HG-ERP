import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { diesService } from '@/modules/dept/technical/dies.service'
import { dieEventSchema } from '@/modules/dept/technical/dies.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Ghi một dòng nhật ký đời khuôn bằng tay (NCC báo hư, gửi sửa, chuyển khuôn…).
 * Mặc định cập nhật luôn hồ sơ theo việc đó — xem `diesService.addEvent`.
 * Không có PATCH / DELETE: nhật ký chỉ thêm, ghi sai thì ghi dòng đính chính.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await diesService.addEvent(user, id, await parseJson(req, dieEventSchema))
  return NextResponse.json({ ok: true }, { status: 201 })
})
