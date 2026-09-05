import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import {
  buildLsxSupplyRows,
  loadPoReportDetails,
} from '@/modules/dept/supply/lsx-supply.service'
import { buildLsxSupplyExcel } from '@/modules/dept/supply/lsx-supply-excel'
import { loadLsxDetailReport } from '@/modules/dept/supply/lsx-detail-report.service'
import { buildLsxDetailExcel } from '@/modules/dept/supply/lsx-detail-excel'
import { NotFound } from '@/server/http'

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
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const today = new Date().toISOString().slice(0, 10)

  // `?lsx=<id>` → HỒ SƠ MỘT LỆNH: lệnh → từng đơn → từng dòng vật tư (user chốt
  // 05/09/2026: người quản lý cần đi sâu từng đơn, không cần bảng gộp mọi lệnh).
  // Không có tham số thì vẫn là bản gộp cũ cho ai còn dùng.
  const lsxId = new URL(req.url).searchParams.get('lsx')
  if (lsxId) {
    const report = await loadLsxDetailReport(user, lsxId, today)
    if (!report) throw NotFound('Không tìm thấy lệnh sản xuất')
    const buf = await buildLsxDetailExcel(report)
    return xlsx(buf, `ho-so-cung-ung_${report.lsx.code.replace(/[\/:*?"<>|]+/g, '-')}_${today}.xlsx`)
  }

  const rows = await buildLsxSupplyRows(user, today)
  // Id đơn có thể lặp giữa các lệnh (đơn mua chung 0125) — lọc trùng trước khi
  // tra, không thì cùng một đơn bị cộng tiền/số lượng nhiều lần.
  const poIds = [...new Set(rows.flatMap((r) => r.pos.map((p) => p.id)))]
  const details = await loadPoReportDetails(poIds)
  const buf = await buildLsxSupplyExcel(rows, today, details)
  return xlsx(buf, `vat-tu-theo-lenh_${today}.xlsx`)
})

function xlsx(buf: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Hai lần khai tên: `filename` ascii cho trình duyệt cũ, `filename*` mới
      // giữ được dấu tiếng Việt — xem lib/storage cho cùng câu chuyện.
      'content-disposition': `attachment; filename="${filename.replace(/[^ -~]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'cache-control': 'no-store',
    },
  })
}
