import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poTermsPatchSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa ĐIỀU KHOẢN & GHI CHÚ của đơn — chữ trên phiếu, không đụng dòng hàng/giá. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, poTermsPatchSchema)
  const po = await posService.updateTerms(user, id, input)
  return NextResponse.json({ po })
})
