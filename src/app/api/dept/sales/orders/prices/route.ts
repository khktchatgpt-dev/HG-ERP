import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { ordersService } from '@/modules/dept/sales/orders.service'
import { orderBulkPriceSchema } from '@/modules/dept/sales/orders.schema'

/**
 * Điền đơn giá HÀNG LOẠT cho nhiều dòng thuộc nhiều đơn (màn /sales/orders/gia).
 *
 * PATCH chứ không POST: không tạo tài nguyên mới, chỉ đặt một cột trên các dòng
 * đã có. Quyền + quyền theo chủ đơn + ghi lịch sử nằm trong service.
 */
export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, orderBulkPriceSchema)
  const result = await ordersService.bulkPrice(user, input)
  return NextResponse.json(result)
})
