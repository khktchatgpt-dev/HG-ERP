import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { issueDocSchema } from '@/modules/dept/warehouse/warehouse.schema'

/** Lập phiếu xuất kho nhiều dòng (PXK — FR-WMS-05/06, BR-09). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, issueDocSchema)
  const result = await stockService.createIssueDoc(user, input)
  return NextResponse.json(result, { status: 201 })
})
