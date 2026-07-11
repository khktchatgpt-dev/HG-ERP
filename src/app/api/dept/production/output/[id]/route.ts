import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { outputsService } from '@/modules/dept/production/outputs.service'

type Params = { params: Promise<{ id: string }> }

/** Xoá bản ghi sản lượng nhập nhầm (append-only: xoá rồi nhập lại, không sửa đè). */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await outputsService.deleteEntry(user, id)
  return NextResponse.json({ ok: true })
})
