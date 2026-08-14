import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'

type Params = { params: Promise<{ id: string }> }

/**
 * Sale TRÌNH GĐ duyệt báo giá (0149 — tuỳ chọn): draft|rejected →
 * pending_approval. Báo giá thường vẫn đi đường /send không qua GĐ.
 */
export const POST = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const quote = await quotesService.submit(user, id)
  return NextResponse.json({ quote })
})
