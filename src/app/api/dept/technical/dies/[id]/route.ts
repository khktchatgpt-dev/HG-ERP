import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { diesService } from '@/modules/dept/technical/dies.service'
import { dieUpdateSchema } from '@/modules/dept/technical/dies.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa hồ sơ khuôn. Đổi trạng thái / nơi giữ / kg/m thì service tự ghi nhật ký. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await diesService.update(user, id, await parseJson(req, dieUpdateSchema))
  return NextResponse.json({ ok: true })
})

/**
 * Xoá hẳn một khuôn. Service chặn nếu còn dòng đơn mua / dòng định mức ghi mã
 * này — xoá lúc đó không làm chúng gãy mà làm chúng mồ côi, tệ hơn cả lỗi.
 */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await diesService.remove(user, id)
  return NextResponse.json({ ok: true })
})
