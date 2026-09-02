import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import {
  buildLsxSupplyRows,
  loadPoReportDetails,
} from '@/modules/dept/supply/lsx-supply.service'
import { buildLsxSupplyExcel } from '@/modules/dept/supply/lsx-supply-excel'

/**
 * BÁO CÁO VẬT TƯ THEO LỆNH — file .xlsx mang vào họp tuần.
 *
 * Đọc: mọi NV đã đăng nhập, cùng tư thế màn `/planning/lsx` mà nó xuất ra. Cố ý
 * không gác riêng cho Cung ứng: người cần file này nhiều nhất là bên SẢN XUẤT
 * và Ban Giám đốc ngồi họp, gác lại là họ phải đi xin.
 *
 * Không nhận tham số kỳ (from/to): báo cáo này là ẢNH CHỤP HIỆN TRẠNG các lệnh
 * đang chạy, không phải thống kê theo kỳ. Thêm khoảng ngày vào đây sẽ hứa một
 * thứ dữ liệu chưa trả lời được — lịch sử chuyển bậc của lệnh không được lưu.
 */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  const today = new Date().toISOString().slice(0, 10)

  const rows = await buildLsxSupplyRows(user, today)
  // Id đơn có thể lặp giữa các lệnh (đơn mua chung 0125) — lọc trùng trước khi
  // tra, không thì cùng một đơn bị cộng tiền/số lượng nhiều lần.
  const poIds = [...new Set(rows.flatMap((r) => r.pos.map((p) => p.id)))]
  const details = await loadPoReportDetails(poIds)
  const buf = await buildLsxSupplyExcel(rows, today, details)
  const filename = `vat-tu-theo-lenh_${today}.xlsx`

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Hai lần khai tên: `filename` ascii cho trình duyệt cũ, `filename*` mới
      // giữ được dấu tiếng Việt — xem lib/storage cho cùng câu chuyện.
      'content-disposition': `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
})
