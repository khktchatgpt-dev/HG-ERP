import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poAdjustSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Sổ điều chỉnh của đơn (0210) — các lần đã áp dụng, cũ → mới, phát sinh. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const adjustments = await posService.listAdjustments(user, id)
  return NextResponse.json({ adjustments })
})

/**
 * Áp dụng một lần điều chỉnh cho đơn đã gửi — sửa tại chỗ, không duyệt lại.
 * 400 PO_ADJUST_INVALID: lý do chặn theo dòng · 409 PO_ADJUST_STALE: có người
 * vừa điều chỉnh chen trước, tải lại đơn.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poAdjustSchema)
  const result = await posService.adjust(user, id, input)
  return NextResponse.json(result)
})
