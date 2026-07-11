import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { outsourceService } from '@/modules/dept/production/outsource.service'

type Params = { params: Promise<{ id: string }> }

/** Xoá bản ghi giao/nhận gia công nhập nhầm (append-only — xoá rồi nhập lại). */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await outsourceService.deleteEntry(user, id)
  return NextResponse.json({ ok: true })
})
