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
  /** Phiếu đang sửa — không tự báo trùng với chính nó (Đ6). */
  tru: z.string().uuid().optional(),
})

/** Tồn / chưa theo dõi, giá lần trước, trùng đề nghị khác, đơn mua còn về (Đ6) cho các mã vừa thêm. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ids, tru } = parseQuery(new URL(req.url), query)
  return NextResponse.json({ goi_y: await deNghiService.goiY(user, ids, tru ?? null) })
})
