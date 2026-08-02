import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'

/**
 * ĐVT + nhóm + nhóm phụ cho form khai vật tư.
 *
 * Gộp ba thứ vào MỘT request vì form mở là cần cả ba; tách ra là ba lượt đi-về
 * cho một lần bấm nút. Mọi NV đã đăng nhập đọc được — đây là danh mục tra cứu,
 * không phải dữ liệu nghiệp vụ.
 */
export const GET = handle(async () => {
  await authService.requireUser()
  return NextResponse.json(await materialTaxonomy())
})
