import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'

type Params = { params: Promise<{ id: string }> }

/** Bản sửa đổi: sao chép thành nháp mới, revision_no + 1 (0225). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  void req
  return NextResponse.json({ quote: await quotesService.revise(user, id) })
})
