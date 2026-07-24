import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { entriesRecordSchema } from '@/modules/dept/production/entries.schema'

type Params = { params: Promise<{ id: string }> }

/** Tổng hợp số liệu + jobs + sổ nhập của LSX — mọi NV đọc. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await entriesService.summary(user, id)
  return NextResponse.json(data)
})

/** Thống kê nhập sổ theo lô: 1 công đoạn + ngày + tổ, nhiều chi tiết. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, entriesRecordSchema)
  const { warnings } = await entriesService.record(user, id, input)
  return NextResponse.json({ ok: true, warnings })
})
