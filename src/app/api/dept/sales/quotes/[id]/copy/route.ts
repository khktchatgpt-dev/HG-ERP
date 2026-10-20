import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'
import { quoteCopySchema } from '@/modules/dept/sales/quotes.schema'

type Params = { params: Promise<{ id: string }> }

/** Nhân bản sang khách khác / cùng khách — nháp mới bản 1. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { customer_id } = await parseJson(req, quoteCopySchema)
  return NextResponse.json({ quote: await quotesService.copy(user, id, customer_id) })
})
