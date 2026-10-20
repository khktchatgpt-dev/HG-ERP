import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { poCostVoidSchema } from '@/modules/dept/supply/po-costs.schema'

type Params = { params: Promise<{ id: string }> }

/** Huỷ phiếu chi phí kèm lý do — không xoá, phiếu còn trong sổ với dấu huỷ. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, poCostVoidSchema)
  const cost = await poCostsService.void(user, id, reason)
  return NextResponse.json({ cost })
})
