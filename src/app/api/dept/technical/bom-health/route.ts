import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { buildBomHealth } from '@/modules/dept/technical/bom-health.service'

/**
 * SỨC KHOẺ ĐỊNH MỨC — ảnh chụp hiện trạng nợ BOM của toàn bộ hồ sơ SP.
 *
 * Chỉ ĐỌC, mọi NV đã đăng nhập xem được (lý do ở service). Không nhận tham số
 * lọc: cả bảng chấm một lượt rồi lọc phía client — số hồ sơ ~800 nên payload
 * nhỏ, mà đổi lại người dùng bấm qua lại giữa các rổ lỗi không phải chờ mạng.
 */
export const GET = handle(async () => {
  await authService.requireUser()
  const report = await buildBomHealth()
  return NextResponse.json(report)
})
