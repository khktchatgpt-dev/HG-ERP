import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'

const bodySchema = z.object({ label: z.string().trim().min(1).max(100) })

/**
 * TẠO DANH MỤC SP NGAY TRONG FORM HỒ SƠ (13/08/2026). Cửa hẹp: chỉ loại
 * `product_category`, chỉ người sửa được hồ sơ SP — xem `createCategory`.
 * Danh mục dùng chung nói chung vẫn do admin quản ở /admin/catalogs.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { label } = await parseJson(req, bodySchema)
  const category = await productsService.createCategory(user, label)
  return NextResponse.json({ category })
})
