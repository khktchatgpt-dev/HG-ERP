import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { quotesService } from '@/modules/dept/sales/quotes.service'

const querySchema = z.object({ ids: z.string().max(5000).optional() })

/**
 * Giá thành kế hoạch theo SP cho form lập báo giá (0225). KHÔNG 403 khi thiếu
 * quyền — trả {} để form vẫn dùng được, chỉ không thấy cột giá thành.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ids } = parseQuery(new URL(req.url), querySchema)
  const list = (ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 300)
  return NextResponse.json({ prices: await quotesService.planPricesFor(user, list) })
})
