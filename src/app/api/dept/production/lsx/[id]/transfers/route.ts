import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { transfersService } from '@/modules/dept/production/transfers.service'
import { transferRecordSchema } from '@/modules/dept/production/transfers.schema'

type Params = { params: Promise<{ id: string }> }

/** Sổ bàn giao nội bộ + đối chiếu WIP per (chi tiết × công đoạn × tổ). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await transfersService.list(user, id)
  return NextResponse.json(data)
})

/** Thống kê ghi 1 dòng giao (issue) / trả lại (return) cho tổ. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, transferRecordSchema)
  const { warnings } = await transfersService.record(user, id, input)
  return NextResponse.json({ ok: true, warnings })
})
