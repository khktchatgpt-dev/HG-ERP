import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'

type Params = { params: Promise<{ id: string }> }

/** Sale tự chốt & gửi khách (FR-SAL-03): draft → sent. Không qua Giám đốc. */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const quote = await quotesService.send(user, id)
  return NextResponse.json({ quote })
})
