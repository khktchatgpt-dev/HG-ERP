import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'

type Params = { params: Promise<{ id: string }> }

/** Sale rút báo giá. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  void req
  return NextResponse.json({ quote: await quotesService.cancel(user, id) })
})
