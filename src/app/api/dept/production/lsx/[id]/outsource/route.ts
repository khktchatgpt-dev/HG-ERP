import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import {
  outsourceService,
  outsourceRecordSchema,
} from '@/modules/dept/production/outsource.service'

type Params = { params: Promise<{ id: string }> }

/** Đối chiếu gia công ngoài của LSX (giao/nhận/thiếu/%HT) — mọi NV đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await outsourceService.summary(user, id)
  return NextResponse.json(data)
})

/** Ghi 1 lần giao / nhận gia công ngoài (FR-OS-01/02). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, outsourceRecordSchema)
  const { warnings } = await outsourceService.record(user, id, input)
  return NextResponse.json({ ok: true, warnings })
})
