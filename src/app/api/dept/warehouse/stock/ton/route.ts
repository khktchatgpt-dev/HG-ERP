import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockRepo } from '@/modules/dept/warehouse/stock.repo'

const query = z.object({
  /** Danh sách uuid cách nhau bằng dấu phẩy — tối đa 200 mã một lượt. */
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

/**
 * Tồn theo ba rổ của một tập mã (Bước 2 Kho) — form phiếu xuất tra lúc thêm
 * dòng. Đọc view `warehouse_stock`, mọi người đăng nhập đều xem được (cùng
 * tư thế với `/planning/stock` của Cung ứng).
 */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { ids } = parseQuery(new URL(req.url), query)
  const rows = await stockRepo.byIds(ids)
  return NextResponse.json({ rows })
})
