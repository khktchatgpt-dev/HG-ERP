import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poLsxSplitPatchSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa CHIA LỆNH của đơn — chỉ phần chia SL theo lệnh, không đổi SL/giá/tiền (10/10/2026). */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poLsxSplitPatchSchema)
  const r = await posService.updateLsxSplits(user, id, input)
  return NextResponse.json(r)
})
