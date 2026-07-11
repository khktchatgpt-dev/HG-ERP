import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { outputsService } from '@/modules/dept/production/outputs.service'
import { outputRecordSchema } from '@/modules/dept/production/outputs.schema'

type Params = { params: Promise<{ id: string }> }

/** Tổng hợp sản lượng + sổ nhập của LSX (FR-PR-04/05/06) — mọi NV đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await outputsService.summary(user, id)
  return NextResponse.json(data)
})

/** Nhập sản lượng theo lô: 1 công đoạn + ngày + tổ, nhiều chi tiết (FR-PR-02/03). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, outputRecordSchema)
  const { warnings } = await outputsService.record(user, id, input)
  return NextResponse.json({ ok: true, warnings })
})
