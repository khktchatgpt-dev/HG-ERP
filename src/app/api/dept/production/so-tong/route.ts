import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { soTongService } from '@/modules/dept/production/so-tong.service'
import { buildSoTongExcel } from '@/modules/dept/production/so-tong-excel'

/**
 * SỔ TỔNG toàn xưởng — JSON hoặc Excel (?format=xlsx[&month=YYYY-MM]).
 * Đọc: mọi NV đã đăng nhập — cùng tư thế các màn thống kê.
 */

const querySchema = z.object({
  format: z.enum(['json', 'xlsx']).default('json'),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
})

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  const data = await soTongService.build(user)
  if (q.format === 'xlsx') {
    const buf = await buildSoTongExcel(data, q.month ?? null)
    const filename = q.month ? `so-tong_${q.month}.xlsx` : 'so-tong_luy-ke.xlsx'
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'content-type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    })
  }
  return NextResponse.json(data)
})
