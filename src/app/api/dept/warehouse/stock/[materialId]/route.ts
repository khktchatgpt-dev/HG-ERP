import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'

const params = z.object({ materialId: z.string().uuid() })

/**
 * Chi tiết một mã — ô mở dưới dòng của màn Tồn kho (Kho lối ERP · B1): tồn theo
 * kệ + biến động gần nhất. Chỉ đọc.
 */
export const GET = handle(
  async (_req: Request, ctx: { params: Promise<{ materialId: string }> }) => {
    const user = await authService.requireUser()
    const { materialId } = params.parse(await ctx.params)
    return NextResponse.json(await stockService.chiTietMa(user, materialId))
  },
)
