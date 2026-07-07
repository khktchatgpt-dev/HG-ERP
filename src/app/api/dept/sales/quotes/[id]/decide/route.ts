import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { quoteDecideSchema } from '@/modules/dept/sales/quotes.schema'

type Params = { params: Promise<{ id: string }> }

/** GĐ duyệt / từ chối báo giá (BR-04, FR-ADM-03): pending → approved | rejected. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { decision, reason } = await parseJson(req, quoteDecideSchema)
  const quote = await quotesService.decide(user, id, decision, reason)
  return NextResponse.json({ quote })
})
