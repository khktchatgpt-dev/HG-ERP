import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { loadSupplyOrdersReport } from '@/modules/dept/supply/supply-orders-report.service'
import { buildSupplyOrdersExcel } from '@/modules/dept/supply/supply-orders-excel'
import { loadLsxDetailReport } from '@/modules/dept/supply/lsx-detail-report.service'
import { buildLsxDetailExcel } from '@/modules/dept/supply/lsx-detail-excel'
import { NotFound } from '@/server/http'
import { xlsxResponse as xlsx } from '@/server/xlsx'

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
  // Không có tham số = FILE HỌP (13/09/2026: cùng thang 5 mức với màn và ba trang
  // họp; bản gộp thang cũ đã bỏ). Giữ đường này cho link cũ, bản chính là hop-report.
  const url = new URL(req.url)
  const lsxId = url.searchParams.get('lsx')
  if (lsxId) {
    // Hai loại file riêng — xem LsxExcelKind. Thiếu tham số thì hiểu là hồ sơ
    // lệnh (đường cũ, để link đã gửi cho ai đó vẫn tải được).
    const kind = url.searchParams.get('loai') === 'bangke' ? 'bangke' : 'lsx'
    const report = await loadLsxDetailReport(
      user,
      lsxId,
      today,
      url.searchParams.get('nhap') === '1',
      kind,
    )
    if (!report) throw NotFound('Không tìm thấy lệnh sản xuất')
    const buf = await buildLsxDetailExcel(report, kind)
    const safe = report.lsx.code.replace(/[\/:*?"<>|]+/g, '-')
    return xlsx(
      buf,
      kind === 'bangke'
        ? `bang-ke-vat-tu_${safe}_${today}.xlsx`
        : `ho-so-cung-ung_${safe}_${today}.xlsx`,
    )
  }

  const report = await loadSupplyOrdersReport(user, today)
  const buf = await buildSupplyOrdersExcel(report!)
  return xlsx(buf, `bao-cao-don-hang_moi-lenh_${today}.xlsx`)
})
