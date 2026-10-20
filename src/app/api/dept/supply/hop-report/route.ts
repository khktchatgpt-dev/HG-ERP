import { NotFound, handle } from '@/server/http'
import { xlsxResponse } from '@/server/xlsx'
import { authService } from '@/modules/core/auth/auth.service'
import { loadSupplyOrdersReport } from '@/modules/dept/supply/supply-orders-report.service'
import { buildSupplyOrdersExcel } from '@/modules/dept/supply/supply-orders-excel'

/**
 * BÁO CÁO ĐƠN HÀNG THEO LỆNH SẢN XUẤT — file .xlsx cho họp sản xuất.
 *
 *  - Không tham số: MỌI lệnh đang chạy.
 *  - `?lsx=<id>`: MỘT lệnh, cùng khuôn (user chốt 13/09/2026: xuất theo lệnh
 *    hoặc xuất tổng quan).
 *
 * Đọc: mọi NV đã đăng nhập, cùng tư thế `lsx-report` — người cần file nhất là
 * bên Sản xuất và Ban Giám đốc ngồi họp. Không nhận tham số kỳ: đây là hiện
 * trạng hôm nay, không phải thống kê theo kỳ.
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const today = new Date().toISOString().slice(0, 10)
  const lsxId = new URL(req.url).searchParams.get('lsx')
  const report = await loadSupplyOrdersReport(user, today, lsxId)
  if (!report) throw NotFound('Không tìm thấy lệnh sản xuất')
  const buf = await buildSupplyOrdersExcel(report)
  const safe =
    report.scope.kind === 'lsx'
      ? report.scope.code.replace(/[\/:*?"<>|]+/g, '-')
      : 'moi-lenh'
  return xlsxResponse(buf, `bao-cao-don-hang_${safe}_${today}.xlsx`)
})
