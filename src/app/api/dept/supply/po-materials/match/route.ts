import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poMaterialsRepo } from '@/modules/dept/supply/po-materials.repo'

const bodySchema = z.object({
  /** Dòng dán từ sổ Excel — tên bắt buộc, mã nếu sổ có cột mã. */
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        code: z.string().trim().max(60).optional().nullable(),
      }),
    )
    .min(1)
    .max(100),
})

/**
 * Khớp vùng DÁN TỪ EXCEL với danh mục vật tư (0136) — cho nút "Dán từ Excel"
 * của form soạn đơn. Cùng cổng đăng-nhập với ô chọn vật tư (GET po-materials);
 * ba bậc tin cậy code/sure/fuzzy — xem `poMaterialsRepo.matchMany`.
 */
export const POST = handle(async (req: Request) => {
  await authService.requireUser()
  const { items } = await parseJson(req, bodySchema)
  return NextResponse.json({ results: await poMaterialsRepo.matchMany(items) })
})
