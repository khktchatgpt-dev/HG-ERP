import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poConfirmSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * NCC xác nhận đơn (0152) — NV cung ứng ghi lại cam kết + kế hoạch giao theo
 * đợt. Đơn `ordered` → `confirmed`; expected_at đồng bộ = ngày đợt sớm nhất.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poConfirmSchema)
  const po = await posService.confirm(user, id, input)
  return NextResponse.json({ po })
})
