import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import {
  poCostCreateSchema,
  poCostListQuery,
} from '@/modules/dept/supply/po-costs.schema'

/** Phiếu chi phí vận chuyển: theo một đơn (`po_id`) hoặc cả sổ chuyến — gồm cả phiếu đã huỷ. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { po_id } = parseQuery(new URL(req.url), poCostListQuery)
  const costs = po_id
    ? await poCostsService.listByPo(user, po_id)
    : await poCostsService.listAll(user)
  return NextResponse.json({ costs })
})

/**
 * Lập phiếu: hình thức (nhà xe / ship lẻ / NCC tự giao), người thu (danh mục
 * hoặc gõ tay), ai trả (chưa trả → Kế toán; đã trả tại chỗ → chi hộ), tiền
 * chưa VAT + VAT, một hoặc nhiều đơn — server tự chia theo tiền hàng mỗi đơn.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, poCostCreateSchema)
  const cost = await poCostsService.create(user, input)
  return NextResponse.json({ cost }, { status: 201 })
})
