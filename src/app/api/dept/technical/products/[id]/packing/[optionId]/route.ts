import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { packingService } from '@/modules/dept/technical/packing.service'
import { packingOptionUpdateSchema } from '@/modules/dept/technical/packing.schema'

type Params = { params: Promise<{ id: string; optionId: string }> }

/** Sửa phương án: nhãn, cái/thùng, 40HC, mặc định, hoặc thay trọn danh sách kiện. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, optionId } = await params
  const patch = await parseJson(req, packingOptionUpdateSchema)
  await packingService.update(user, id, optionId, patch)
  return NextResponse.json({ ok: true })
})

export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id, optionId } = await params
  await packingService.remove(user, id, optionId)
  return NextResponse.json({ ok: true })
})
