import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { quoteLostSchema } from '@/modules/dept/sales/quotes.schema'

type Params = { params: Promise<{ id: string }> }

/** Đánh dấu thua — lý do bắt buộc. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, quoteLostSchema)
  return NextResponse.json({ quote: await quotesService.markLost(user, id, reason) })
})
