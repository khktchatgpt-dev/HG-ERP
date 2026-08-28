import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'

type Params = { params: Promise<{ id: string }> }

/**
 * LỊCH SỬ GIÁ MUA của một vật tư — nuôi tab "Giá mua" ở hộp Lịch sử của danh
 * mục. Đọc thẳng từ dòng đơn đặt, không có bảng lịch sử riêng (xem
 * `priceHistoryByMaterial`).
 */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const prices = await posService.materialPriceHistory(user, id)
  return NextResponse.json({ prices })
})
