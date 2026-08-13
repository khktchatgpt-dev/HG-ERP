import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialEnrichSchema } from '@/modules/dept/warehouse/warehouse.schema'

/**
 * CẬP NHẬT DANH MỤC từ hộp xác nhận sau khi lưu đơn đặt (13/08/2026): form gửi
 * danh sách người soạn vừa duyệt; service kiểm fill-empty-only lần nữa trên
 * bản danh mục mới nhất rồi mới ghi — không bao giờ đè.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { items } = await parseJson(req, materialEnrichSchema)
  const result = await materialsService.enrichFromOrder(user, items)
  return NextResponse.json(result)
})
