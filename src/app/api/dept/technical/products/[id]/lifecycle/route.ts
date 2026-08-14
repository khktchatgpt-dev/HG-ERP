import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productLifecycleSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * CẬP NHẬT TRẠNG THÁI hồ sơ SP (0145): Nháp → Đang rà soát → Đã duyệt mẫu →
 * Đang sản xuất → Ngừng dùng. Kỹ thuật + Bán hàng + Giám đốc
 * (`technical.product.lifecycle`). Lùi chặng thì service bắt ghi lý do.
 *
 * Thay cho route `[id]/sample` của 0141 — "đã duyệt mẫu" nay là một chặng.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { to, reason } = await parseJson(req, productLifecycleSchema)
  const product = await productsService.setLifecycle(user, id, to, reason)
  return NextResponse.json({ product })
})
