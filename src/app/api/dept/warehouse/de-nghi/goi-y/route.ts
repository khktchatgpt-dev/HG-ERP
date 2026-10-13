import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

const query = z.object({
  /** uuid cách nhau bằng dấu phẩy — tối đa 200 mã một lượt. */
  ids: z
    .string()
    .trim()
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().uuid()).min(1).max(200)),
})

/** Tồn dùng được + giá mua gần nhất cho các mã vừa thêm vào phiếu đề nghị. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ids } = parseQuery(new URL(req.url), query)
  return NextResponse.json({ goi_y: await deNghiService.goiY(user, ids) })
})
