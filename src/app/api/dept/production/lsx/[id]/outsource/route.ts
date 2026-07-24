import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { outsourceService } from '@/modules/dept/production/outsource.service'
import { outsourceEntrySchema } from '@/modules/dept/production/entries.schema'

type Params = { params: Promise<{ id: string }> }

/** Sổ gia công ngoài + đối chiếu per (chi tiết, NCC) — mọi NV đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await outsourceService.list(user, id)
  return NextResponse.json(data)
})

/** Ghi 1 dòng giao/nhận gia công ngoài. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, outsourceEntrySchema)
  await outsourceService.record(user, id, input)
  return NextResponse.json({ ok: true }, { status: 201 })
})
