import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { chamCongService } from '@/modules/dept/hr/cham-cong/cham-cong.service'
import { gioCongService } from '@/modules/dept/hr/cham-cong/gio-cong.service'
import { motNguoiQuerySchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'
import { todayVn } from '@/lib/date-vn'

/**
 * Chấm công MỘT người theo khoảng ngày — mọi ngày, kể cả ngày không quẹt: lượt quẹt
 * (`motNguoi`) + công từng ngày lấy từ Bảng công (`chiTietNguoi`).
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ma, tu, den } = parseQuery(new URL(req.url), motNguoiQuerySchema)
  const [mot, tinh] = await Promise.all([
    chamCongService.motNguoi(user, ma, { tu, den }),
    gioCongService.chiTietNguoi(user, ma, { tu, den }, todayVn()),
  ])
  return NextResponse.json({ ...mot, tinh })
})
