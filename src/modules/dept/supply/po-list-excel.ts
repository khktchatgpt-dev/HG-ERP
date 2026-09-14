import ExcelJS from 'exceljs'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import { roundMoney } from '@/lib/po-line'
import {
  MONEY_FMT,
  applyWidths,
  dateCell,
  dateCols,
  finishTable,
  headerRow,
  noteRow,
  numberCols,
  stampWorkbook,
  titleRow,
  totalRow,
} from './excel-kit'

/**
 * XUẤT DANH SÁCH ĐƠN MUA ĐANG LỌC (15/09/2026).
 *
 * Khoảng trống lớn nhất của mảng Excel: phòng có file cho MỘT đơn (phiếu gửi
 * NCC), cho MỘT lệnh, và cho buổi họp — nhưng không có file cho "23 đơn tôi
 * vừa lọc ra". Quản lý lọc "nháp chưa gửi, tháng này" rồi cần gửi Giám đốc ký
 * hoặc lưu hồ sơ thì phải mở từng đơn xuất từng file. Màn cũ cũng không có.
 *
 * FILE LÀ CÁI MÀN HÌNH, ĐÓNG BĂNG LẠI. Dòng chú thích đầu sheet ghi nguyên
 * văn bộ lọc đã dùng và số đơn — nếu không, ba tháng sau mở file ra không ai
 * biết nó là 23 đơn nào trong 69, và con số tổng ở chân bảng thành vô nghĩa.
 *
 * TIỀN CỘNG RIÊNG TỪNG LOẠI, không quy đổi — cùng luật với mọi màn của khu.
 * Đơn ĐÃ HUỶ vẫn in ra (người đọc cần thấy nó tồn tại) nhưng KHÔNG cộng tiền,
 * và chân bảng nói ra số đơn huỷ đã bị loại khỏi tổng.
 */

export type PoListRow = {
  code: string
  supplier_name: string
  lsx_code: string | null
  order_code: string | null
  status: string
  created_at: string
  expected_at: string | null
  assignee_name: string | null
  currency: string
  total: number
  lines_done: number
  lines_total: number
}

export type PoListReport = {
  /** Câu mô tả bộ lọc đang áp, viết cho người đọc file. */
  filterText: string
  rows: PoListRow[]
}

const COLS = [
  'Số đơn',
  'Nhà cung cấp',
  'Lệnh sản xuất',
  'Đơn hàng khách',
  'Trạng thái',
  'Ngày lập',
  'Hẹn giao',
  'Về kho',
  'Người phụ trách',
  'Tiền tệ',
  'Giá trị',
]

export async function buildPoListExcel(report: PoListReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, 'Danh sách đơn mua')
  const ws = wb.addWorksheet('Đơn mua')

  titleRow(ws, 'DANH SÁCH ĐƠN ĐẶT VẬT TƯ')
  noteRow(ws, report.filterText)
  ws.addRow([])

  const head = headerRow(ws, COLS)

  const tien: Record<string, number> = {}
  let huy = 0
  for (const r of report.rows) {
    const huyDon = r.status === 'cancelled'
    if (huyDon) huy++
    else tien[r.currency] = (tien[r.currency] ?? 0) + r.total

    ws.addRow([
      r.code,
      r.supplier_name,
      r.lsx_code ?? '',
      r.order_code ?? '',
      isPoStatus(r.status) ? PO_STATUS_LABEL[r.status] : r.status,
      dateCell(r.created_at),
      dateCell(r.expected_at),
      // "8/11 dòng" chứ không phải phần trăm: Kho nhận từng mã một, và người
      // đọc cần biết CÒN MẤY DÒNG, không phải 73%.
      r.lines_total > 0 ? `${r.lines_done}/${r.lines_total}` : '',
      r.assignee_name ?? '',
      r.currency,
      huyDon ? null : r.total,
    ])
  }

  numberCols(ws, [11], MONEY_FMT)
  dateCols(ws, [6, 7])
  applyWidths(ws, [14, 30, 18, 18, 14, 12, 12, 10, 18, 8, 16])

  /*
    MỘT DÒNG TỔNG CHO MỖI LOẠI TIỀN. Gộp một dòng rồi dán đuôi "₫" ra một con
    số không tồn tại — cùng lý do mọi màn của khu không quy đổi.
  */
  const loai = Object.entries(tien).filter(([, v]) => v > 0)
  if (loai.length === 0) {
    totalRow(ws, `Cộng ${report.rows.length} đơn — chưa đơn nào có tiền`, {})
  } else {
    for (const [cur, v] of loai) {
      /*
        LÀM TRÒN THEO LOẠI TIỀN trước khi ghi vào ô. Cộng dồn số lẻ ra
        `299145.39400000003` — định dạng ô che đi, nhưng GIÁ TRỊ THẬT trong file
        vẫn lệch, và người nhận copy sang sổ khác là mang theo cái đuôi đó.
        Cùng luật `poTotals` đang dùng: VND về đồng, USD về cent.
      */
      totalRow(ws, `Cộng ${report.rows.length} đơn · ${cur}`, {
        10: cur,
        11: roundMoney(v, cur),
      })
    }
  }
  noteRow(
    ws,
    huy > 0
      ? `Tổng KHÔNG gồm ${huy} đơn đã huỷ (vẫn in ở trên để đối chiếu). Cộng riêng từng loại tiền, không quy đổi.`
      : 'Cộng riêng từng loại tiền, không quy đổi.',
    huy > 0 ? 'warn' : 'muted',
  )

  finishTable(ws, { head, lastRow: head.number + report.rows.length, freezeCols: 1 })
  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}

/** Dòng chú thích mô tả bộ lọc — viết cho người mở file ba tháng sau. */
export function describeFilter(
  sp: Record<string, string | undefined>,
  n: number,
): string {
  const p: string[] = []
  if (sp.nhin) p.push(`khung nhìn "${sp.nhin}"`)
  if (sp.q) p.push(`từ khoá "${sp.q}"`)
  if (sp.trang_thai) p.push(`trạng thái ${sp.trang_thai}`)
  if (sp.ncc) p.push('lọc theo nhà cung cấp')
  if (sp.lsx) p.push('lọc theo lệnh sản xuất')
  if (sp.loai === 'lsx') p.push('chỉ đơn theo lệnh')
  if (sp.loai === 'standalone') p.push('chỉ đơn ngoài lệnh')
  if (sp.tu || sp.den) p.push(`lập từ ${sp.tu || '…'} đến ${sp.den || '…'}`)
  if (sp.toi === '1') p.push('đơn tôi phụ trách')
  if (sp.tre === '1') p.push('quá hẹn')
  if (sp.chua_hen === '1') p.push('chưa hẹn giao')
  const loc = p.length > 0 ? p.join(' · ') : 'không lọc — toàn bộ sổ'
  return `${n} đơn · ${loc} · xuất lúc ${new Date().toLocaleString('vi-VN')}`
}
