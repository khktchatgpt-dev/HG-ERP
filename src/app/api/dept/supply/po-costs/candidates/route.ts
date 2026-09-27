import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { poCostCandidatesQuery } from '@/modules/dept/supply/po-costs.schema'

/** Đơn đang mở + gợi ý đơn cùng chuyến (cùng nơi giao, nhập ±3 ngày) + kết quả tìm. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { po_id, q } = parseQuery(new URL(req.url), poCostCandidatesQuery)
  return NextResponse.json(await poCostsService.candidates(user, po_id, q))
})
