import ExcelJS from 'exceljs'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import {
  LSX_SUPPLY_GATES,
  compareForSupply,
  daysUntilDue,
  dueLevel,
  lsxSupplyGate,
} from '@/lib/lsx-supply'
import type { LsxSupplyRow, PoReportDetails } from './lsx-supply.service'
import {
  MONEY_FMT,
  PCT_FMT,
  applyWidths,
  dateCell,
  dateCols,
  finishTable,
  headerRow,
  numberCols,
  stampWorkbook,
  titleRow,
  totalRow,
} from './excel-kit'

/**
 * BÁO CÁO VẬT TƯ THEO LỆNH — file mang vào họp tuần.
 *
 * Viết cho NGƯỜI DỰ HỌP BÊN SẢN XUẤT (user chốt 01/09/2026): câu hỏi ở bàn họp
 * là "lệnh nào chạy được, lệnh nào tắc, tắc vì cái gì, bao giờ gỡ". Vì vậy
 * SHEET 1 đi từ LỆNH ra và không có một cột tiền nào.
 *
 * SHEET 2 chép đúng khuôn bảng tay của phòng Cung ứng (sheet "Thao_THĐH" trong
 * file TIEN DO LSX_IBIZA, 01/09/2026) — mỗi đơn một dòng, có cả số lượng và
 * tiền. Tiền nằm ở đây chứ không ở sheet 1 vì đó là bảng của người MUA đọc, còn
 * sheet 1 là bảng cả phòng họp cùng nhìn.
 *
 * File PHẲNG để người nhận tự lọc/SUM tiếp, không cố bày như phiếu in.
 */

const NHAN_BAC: Record<string, string> = {
  none: 'Chưa lập đơn',
  unsent: 'Đơn chưa gửi',
  late: 'NCC trễ',
  inflight: 'Đang về',
  done: 'Về đủ',
}

const fmtD = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('vi-VN') : ''

/**
 * Số ngày còn lại tới hạn; âm = đã quá hạn, rỗng = chưa đặt hạn. Dùng lại
 * `daysUntilDue` của màn hình thay vì tự trừ ngày — lệch một ngày giữa file và
 * màn là kiểu sai không ai phát hiện ra cho tới lúc cãi nhau giữa cuộc họp.
 */
const conLaiNgay = (due: string | null, today: string): number | '' =>
  daysUntilDue(due, today) ?? ''

/** Số ngày NCC hẹn giao = hẹn giao − ngày đặt. Thiếu một trong hai thì bỏ trống. */
function soNgayGiao(orderedAt: string | null, expectedAt: string | null): number | '' {
  if (!orderedAt || !expectedAt) return ''
  const d = daysUntilDue(expectedAt, orderedAt.slice(0, 10))
  return d ?? ''
}

/**
 * Cột "Hành động cần làm" — câu ngắn NÓI VIỆC, không nói trạng thái. Trạng thái
 * đã có cột riêng ngay bên cạnh; lặp lại nó ở đây là tốn một cột mà không thêm
 * thông tin nào cho người ngồi họp.
 */
function hanhDong(p: LsxSupplyRow['pos'][number]): string {
  if (p.status === 'draft') return '→ Hoàn thiện đơn rồi trình ký'
  if (p.status === 'pending_approval') return '→ Chờ duyệt — nhắc người ký'
  if (p.status === 'approved') return '→ Đã duyệt, chưa gửi NCC'
  if (p.late) return '⚠ Quá hẹn — giục nhà cung cấp'
  if (p.status === 'partial') return '→ Về chưa đủ — bám phần còn lại'
  if (p.status === 'received') return '✔ Không cần xử lý'
  return '✔ Không cần xử lý'
}

export async function buildLsxSupplyExcel(
  rows: LsxSupplyRow[],
  today: string,
  /**
   * Số liệu chi tiết theo đơn (SL, tiền, ngày về thực tế…). Cho phép RỖNG để
   * test dựng file không cần chạm DB — khi đó các cột đó để trống chứ không
   * đoán số.
   */
  details: PoReportDetails = {},
): Promise<Buffer> {
  // Cùng thứ tự với màn hình: việc gấp nhất nằm trên. Người đọc file và người
  // mở màn hình phải thấy cùng một trật tự ưu tiên, không thì họp mỗi người
  // đọc một danh sách khác nhau.
  const xep = rows
    .map((r) => ({
      row: r,
      gate: lsxSupplyGate(r),
      due: dueLevel(r.materials_due_at, today),
    }))
    .sort((a, b) =>
      compareForSupply(
        { gate: a.gate, due: a.due, code: a.row.code },
        { gate: b.gate, due: b.due, code: b.row.code },
      ),
    )

  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `Vật tư theo lệnh — ${fmtD(today)}`)

  // ── Sheet 1: mỗi lệnh một dòng ────────────────────────────────────────────
  const s1 = wb.addWorksheet('Vật tư theo lệnh')

  titleRow(s1, `BÁO CÁO VẬT TƯ THEO LỆNH SẢN XUẤT — ${fmtD(today)}`)
  s1.addRow([])

  // Khối tóm tắt: đếm theo bậc. Đây là mấy con số đọc lên đầu buổi họp.
  const dem = new Map<string, number>()
  for (const x of xep) dem.set(x.gate.key, (dem.get(x.gate.key) ?? 0) + 1)
  headerRow(s1, ['Tình trạng vật tư', 'Số lệnh'])
  for (const k of LSX_SUPPLY_GATES) s1.addRow([NHAN_BAC[k] ?? k, dem.get(k) ?? 0])
  s1.addRow(['TỔNG', xep.length]).font = { bold: true }
  s1.addRow([])

  const s1Head = headerRow(s1, [
    'Lệnh SX',
    'Khách hàng',
    'Sản phẩm',
    'Ngày giao',
    'Hạn vật tư',
    'Còn (ngày)',
    'Tình trạng vật tư',
    'Diễn giải',
    'Số đơn mua',
    'Chưa gửi',
    'Đang về',
    'Trễ',
  ])
  for (const { row: r, gate } of xep) {
    // Gộp mã SP thay vì liệt kê từng dòng: bảng này để nhìn TOÀN CẢNH lệnh,
    // chi tiết sản phẩm đã có trên màn lệnh sản xuất.
    const sp = r.products.map((p) => `${p.code} x${p.qty}`).join(', ')
    s1.addRow([
      r.code,
      r.customer_name,
      sp,
      dateCell(r.ship_date),
      dateCell(r.materials_due_at),
      conLaiNgay(r.materials_due_at, today),
      NHAN_BAC[gate.key] ?? gate.key,
      gate.detail,
      r.posTotal,
      r.posUnsent,
      r.posOpen,
      r.posLate,
    ])
  }
  numberCols(s1, [6, 9, 10, 11, 12])
  dateCols(s1, [4, 5])
  applyWidths(s1, [16, 18, 40, 12, 12, 11, 16, 42, 11, 10, 9, 7])
  for (const c of [2, 3, 8]) {
    s1.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
  }
  finishTable(s1, { head: s1Head, freezeCols: 1 })

  /*
   * ── Sheet 2: TỔNG HỢP ĐƠN HÀNG THEO LSX ─────────────────────────────────
   *
   * Bộ cột lấy ĐÚNG theo sheet "Thao_THĐH" mà phòng Cung ứng đang làm tay
   * (file TIEN DO LSX_IBIZA) — đó là bảng người ta thật sự đọc trong họp, nên
   * chép khuôn đó thay vì nghĩ ra bộ cột mới rồi bắt người dùng học lại.
   */
  const s2 = wb.addWorksheet('Tổng hợp ĐH theo LSX')
  const s2Head = headerRow(s2, [
    'STT',
    'Nhà cung cấp',
    'Nhóm VT chính',
    'Số ĐH',
    'LSX',
    'Khách hàng',
    'Ngày đặt',
    'Số ngày giao',
    'Ngày về dự kiến',
    'Ngày về thực tế',
    'Deadline hàng về',
    'Trạng thái',
    'Số ngày trễ',
    'Hành động cần làm',
    'SL đặt',
    'SL đã nhận',
    '% nhận',
    'Số mã còn thiếu',
    'Tổng thanh toán',
    'Đã trả',
    'Còn nợ',
    'Ghi chú',
    'Người theo dõi',
    'Mua chung',
  ])

  let stt = 0
  for (const { row: r } of xep) {
    for (const p of r.pos) {
      const d = details[p.id]
      const daNhan = d?.qty_received ?? 0
      const daDat = d?.qty_ordered ?? 0
      const tien = d?.amount ?? 0
      const daTra = d?.paid ?? 0
      // Số ngày TRỄ tính theo hẹn giao của đơn, chỉ có nghĩa khi đơn đang trễ —
      // đơn còn hạn mà in số dương ở cột này thì đọc thành "trễ n ngày".
      const soNgayTre = p.late
        ? Math.abs(Number(conLaiNgay(p.expected_at, today)) || 0)
        : ''
      s2.addRow([
        ++stt,
        p.supplier_name,
        d?.material_group ?? '',
        p.code,
        r.code,
        r.customer_name,
        dateCell(p.ordered_at),
        soNgayGiao(p.ordered_at, p.expected_at),
        dateCell(p.expected_at),
        dateCell(d?.received_at ?? null),
        dateCell(r.materials_due_at),
        isPoStatus(p.status) ? PO_STATUS_LABEL[p.status] : p.status,
        soNgayTre,
        hanhDong(p),
        daDat || '',
        daNhan || '',
        // Để TRỐNG thay vì in 0% khi chưa đặt số lượng nào: 0% đọc thành "đã
        // đặt mà chưa về", còn thực tế là "chưa có số để tính".
        daDat > 0 ? Math.round((daNhan / daDat) * 100) / 100 : '',
        d?.lines_missing ?? 0,
        tien,
        daTra,
        tien - daTra,
        p.note ?? '',
        p.assignee_name ?? '',
        p.shared ? 'x' : '',
      ])
    }
  }
  // Nói thẳng khi rỗng. Một sheet trắng trơn khiến người nhận tưởng file lỗi,
  // trong khi sự thật ("chưa lập đơn mua nào") mới là điều cần báo cáo.
  if (stt === 0) s2.addRow(['— Chưa có đơn mua nào cho các lệnh đang chạy —'])

  const s2Last = s2.rowCount
  // Chỉ đếm số đơn, KHÔNG cộng tiền: bảng này gộp mọi lệnh nên có cả đơn VND
  // lẫn USD mà không mang cột tiền tệ — cộng chung là ra một con số vô nghĩa.
  if (stt > 0) totalRow(s2, `Cộng ${stt} đơn`, {}, 2)
  numberCols(s2, [8, 13, 15, 16, 18])
  numberCols(s2, [17], PCT_FMT)
  numberCols(s2, [19, 20, 21], MONEY_FMT)
  dateCols(s2, [7, 9, 10, 11])
  applyWidths(s2, [
    5, 24, 16, 16, 16, 18, 11, 9, 13, 13, 14, 15, 8, 26, 10, 11, 8, 9, 15, 14, 14, 24, 13,
    10,
  ])
  for (const c of [2, 6, 14, 22]) {
    s2.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
  }
  finishTable(s2, { head: s2Head, lastRow: s2Last, freezeCols: 4 })

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
