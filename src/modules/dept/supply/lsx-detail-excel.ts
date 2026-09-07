import ExcelJS from 'exceljs'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import type { MeetingRisk } from '@/lib/supply-meeting'
import type { LsxSupplyDetail } from './lsx-supply.service'
import { BANG_KE_STATUS, estimateByCurrency, type BangKeRow } from '@/lib/lsx-bang-ke'
import {
  MONEY_FMT,
  PCT_FMT,
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
 * HỒ SƠ CUNG ỨNG MỘT LỆNH — file Excel đi từ LỆNH xuống từng ĐƠN rồi từng DÒNG
 * VẬT TƯ (user chốt 05/09/2026: người quản lý cần "vào sâu hơn từng đơn hàng
 * ra sao", không cần bảng gộp mọi lệnh).
 *
 * Khuôn theo sổ tay của Cung ứng (file TIEN DO LSX_IBIZA):
 *   - Sheet "Lệnh"     ← đầu sổ: khách, sản phẩm, hạn, mức rủi ro, mã còn hụt.
 *   - Sheet "Đơn mua"  ← sheet Thao_THĐH: mỗi đơn một dòng, có tiền.
 *   - Sheet "ĐH …"     ← sheet Thao_Visa / Kim Phát…: từng dòng vật tư của
 *                        đơn, SL đặt / nhận theo ĐỢT / còn thiếu / tiền.
 *
 * Thuần: nhận dữ liệu đã nạp, không chạm DB — test dựng file không cần Supabase.
 */

export type LsxReportLine = {
  id: string
  material_code: string
  material_name: string
  spec: string | null
  unit: string
  qty_ordered: number
  qty_received: number
  qty_rejected: number
  qty_missing: number
  closed_short_at: string | null
  last_received_at: string | null
  unit_price: number | null
  qty2: number | null
  unit2: string | null
  note: string | null
}

/** Một ĐỢT nhận của đơn — một phiếu nhập kho. */
export type LsxReportBatch = {
  /** yyyy-mm-dd */
  date: string
  doc_code: string | null
  supplier_doc_no: string | null
  /** line id → SL nhận (đạt + loại) và SL loại. */
  by_line: Record<string, { qty: number; rejected: number }>
}

export type LsxDetailReport = {
  today: string
  lsx: LsxSupplyDetail
  risk: MeetingRisk
  /** po id → dòng vật tư (đúng thứ tự trên đơn). */
  lines: Record<string, LsxReportLine[]>
  /** po id → các đợt nhận, xếp theo ngày. */
  batches: Record<string, LsxReportBatch[]>
  /**
   * BẢNG KÊ VẬT TƯ của lệnh — sheet "cần mua gì" mà người mua đọc trước tiên.
   * Rỗng = lệnh chưa có nhu cầu nào (không sinh sheet, thay vì sinh sheet trắng).
   */
  bangKe?: {
    rows: BangKeRow[]
    /** Dòng định mức chưa quy đổi được sang đơn vị mua — liệt kê ở cuối sheet. */
    blocked: {
      product_code: string
      material_code: string
      material_name: string
      unit: string
      part_name: string
      reason: string
    }[]
    /** Đang tính cả định mức BOM chưa xác nhận? Ghi lên đầu sheet cho khỏi nhầm. */
    include_draft: boolean
    /** SP có định mức mà Kỹ thuật chưa xác nhận — cảnh báo ngay trên sheet. */
    unconfirmed_products: { code: string; name: string; qty: number }[]
  }
}

/** Nguồn số "Cần" — cùng chữ với màn hình để đọc file không phải đoán. */
const NGUON: Record<BangKeRow['source'], string> = {
  manual: 'Cung ứng nhập tay',
  components: 'Bảng định hình',
  bom: 'Định mức đã xác nhận',
  bom_draft: 'BOM CHƯA xác nhận',
  none: 'Ngoài định mức',
}

/**
 * Ngày dạng CHỮ — chỉ dùng cho khối "nhãn: giá trị" ở đầu sheet, nơi ô là một
 * câu chứ không phải một cột. Trong BẢNG thì dùng `dateCell` để ra ô ngày thật
 * (sắp/lọc/trừ ngày được).
 */
const fmtD = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('vi-VN') : ''

/** Dòng "Nhãn | giá trị" cho khối đầu sheet. */
function kv(ws: ExcelJS.Worksheet, label: string, value: ExcelJS.CellValue): void {
  const r = ws.addRow([label, value])
  r.getCell(1).font = { bold: true }
}

function statusLabel(status: string): string {
  return isPoStatus(status) ? PO_STATUS_LABEL[status] : status
}

/** Câu NÓI VIỆC cho từng đơn — cùng lời với màn hình. */
function hanhDong(p: LsxSupplyDetail['pos'][number]): string {
  if (p.status === 'draft') return 'Hoàn thiện đơn rồi trình ký'
  if (p.status === 'pending_approval') return 'Chờ duyệt — nhắc người ký'
  if (p.status === 'approved') return 'Đã duyệt, chưa gửi NCC'
  if (p.status === 'cancelled') return ''
  if (p.late) return 'Quá hẹn — giục nhà cung cấp'
  if (p.status === 'partial') return 'Về chưa đủ — bám phần còn lại'
  if (p.status === 'received') return 'Không cần xử lý'
  return 'Không cần xử lý'
}

/** Tên sheet Excel: ≤ 31 ký tự, cấm []:*?/\ — mã đơn hay có dấu "/". */
export function sheetName(prefix: string, code: string, taken: Set<string>): string {
  const base = `${prefix} ${code}`.replace(/[[\]:*?/\\]/g, '-').slice(0, 31)
  let name = base
  let n = 2
  while (taken.has(name)) {
    const suffix = ` (${n++})`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  taken.add(name)
  return name
}

/**
 * HAI LOẠI FILE, KHÔNG GỘP (user chốt 06/09/2026): file gộp làm cả hai việc
 * nửa vời — người cầm bảng kê phải cuộn qua các sheet đơn hàng, người rà đơn
 * lại vướng bảng kê. Sheet "Lệnh" có ở cả hai vì đó là đầu sổ, nói file này
 * của lệnh nào.
 *
 *   'bangke' → Lệnh · Bảng kê VT · Phân bổ theo SP
 *   'lsx'    → Lệnh · Đơn mua · một sheet cho mỗi đơn (dòng vật tư, đợt nhận)
 */
export type LsxExcelKind = 'bangke' | 'lsx'

export async function buildLsxDetailExcel(
  report: LsxDetailReport,
  kind: LsxExcelKind = 'lsx',
): Promise<Buffer> {
  const { lsx, risk, today } = report
  const wb = new ExcelJS.Workbook()
  stampWorkbook(
    wb,
    kind === 'bangke'
      ? `Bảng kê vật tư — LSX ${lsx.code}`
      : `Hồ sơ cung ứng — LSX ${lsx.code}`,
  )
  const taken = new Set<string>()

  // ── Sheet 1: LỆNH ──────────────────────────────────────────────────────
  const s1 = wb.addWorksheet(sheetName('Lệnh', lsx.code, taken))
  s1.getColumn(1).width = 24
  s1.getColumn(2).width = 60
  titleRow(
    s1,
    kind === 'bangke'
      ? `BẢNG KÊ VẬT TƯ — LSX ${lsx.code}`
      : `HỒ SƠ CUNG ỨNG — LSX ${lsx.code}`,
    14,
  )
  noteRow(s1, `Ngày lập: ${fmtD(today)}`)
  s1.addRow([])
  kv(s1, 'Khách hàng', lsx.customer_name)
  kv(s1, 'Đơn hàng', lsx.order_codes.join(', '))
  kv(s1, 'Ngày xuất', fmtD(lsx.ship_date))
  kv(s1, 'Hạn vật tư về', fmtD(lsx.materials_due_at))
  kv(s1, 'Kho xác nhận đủ', fmtD(lsx.materials_received_at))
  kv(s1, 'Mức rủi ro', risk.label)
  kv(s1, 'Lý do', risk.reason)
  kv(s1, 'Bộ phận cầm bóng', risk.owner)
  kv(s1, 'Việc phải làm', risk.action || '—')
  if (risk.decision) kv(s1, 'Sản xuất cần quyết', risk.decision)
  s1.addRow([])

  s1.addRow(['SẢN PHẨM PHẢI LÀM']).font = { bold: true }
  headerRow(s1, ['Mã SP', 'Tên sản phẩm', 'Số lượng'])
  for (const p of lsx.products) s1.addRow([p.code, p.name, p.qty])
  if (lsx.products.length === 0) s1.addRow(['— Lệnh chưa có dòng sản phẩm —'])
  s1.addRow([])

  s1.addRow(['ĐỘ PHỦ ĐỊNH MỨC']).font = { bold: true }
  const cov = lsx.coverage
  if (cov.needed === 0) {
    s1.addRow(['— Lệnh chưa có định mức vật tư, không tính được còn thiếu —'])
  } else {
    kv(s1, 'Mã vật tư cần', cov.needed)
    kv(s1, 'Đã đủ (tồn + đã đặt)', cov.covered)
    kv(s1, 'Còn hụt', cov.missing)
    if (cov.missing_top.length > 0) {
      headerRow(s1, ['Mã VT', 'Tên vật tư', 'Còn phải mua', 'ĐVT'])
      for (const m of cov.missing_top) s1.addRow([m.code, m.name, m.qty, m.unit])
    }
  }
  s1.getColumn(3).width = 14
  s1.getColumn(4).width = 10
  // Sheet bìa: hai bảng nhỏ nên không bật lọc, chỉ đặt trang in cho gọn.
  s1.pageSetup = { paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  // ── Sheet 2: BẢNG KÊ VẬT TƯ (khuôn "BK thép" của phòng) ───────────────
  // Đặt TRƯỚC sheet đơn mua: câu hỏi đầu tiên của người mua là "còn phải đặt
  // gì", không phải "đã đặt những đơn nào".
  if (kind === 'bangke' && report.bangKe && report.bangKe.rows.length > 0) {
    const bk = report.bangKe
    const sb = wb.addWorksheet('Bảng kê VT')
    titleRow(sb, `BẢNG KÊ VẬT TƯ — LSX ${lsx.code}`)
    noteRow(
      sb,
      bk.include_draft
        ? 'ĐANG TÍNH CẢ ĐỊNH MỨC CHƯA XÁC NHẬN — số Cần chỉ để tham khảo, không gửi đơn theo bản này.'
        : 'Chỉ tính định mức đã được Kỹ thuật xác nhận.',
      bk.include_draft ? 'warn' : 'muted',
    )
    noteRow(
      sb,
      `${lsx.customer_name} · ngày xuất ${fmtD(lsx.ship_date)} · hạn vật tư ${fmtD(lsx.materials_due_at) || 'chưa đặt'}`,
    )
    if (bk.unconfirmed_products.length > 0) {
      noteRow(
        sb,
        `${bk.unconfirmed_products.length} sản phẩm có định mức nhưng chưa xác nhận BOM: ` +
          bk.unconfirmed_products.map((p) => p.code).join(', '),
        'warn',
      )
    }
    sb.addRow([])
    const bkHead = headerRow(sb, [
      'STT',
      'Nhóm vật tư',
      'Mã VT',
      'Tên vật tư',
      // Quy cách: đi hỏi giá mà chỉ có tên thì NCC vẫn hỏi lại độ dày/chiều dài.
      'Quy cách',
      'ĐVT',
      'Cần',
      // Cùng một con số, hai nghĩa khác nhau tuỳ chế độ — nói rõ ở tiêu đề
      // thay vì để người đọc tự đoán đã cộng hay chưa.
      bk.include_draft ? 'Trong đó: chưa xác nhận' : 'Chưa xác nhận (chưa tính)',
      'Đã xuất',
      'Tồn khả dụng',
      'Đã đặt',
      'Nháp/chờ ký',
      'Đã về',
      'Còn phải đặt',
      // Khối GIÁ lấy từ dòng đơn thật (xem BangKeRow.last_price) — để người mua
      // ước được tiền và biết gọi ai mà không phải mở tab khác.
      'Đơn giá gần nhất',
      'Tiền tệ',
      'Tạm tính',
      'Mua lần cuối',
      'NCC đã mua',
      'Tình trạng',
      'Nguồn số Cần',
      'Đơn mua',
      'Ghi chú',
    ])
    let i = 0
    for (const r of bk.rows) {
      i++
      // Số 0 để NGUYÊN LÀ SỐ — hiện thành ô trống là việc của định dạng
      // (NUM_FMT). Nhét chuỗi rỗng vào cột số thì lọc và SUM đều lệch.
      sb.addRow([
        i,
        r.group_name ?? '',
        r.material_code,
        r.material_name,
        r.spec ?? '',
        r.unit,
        r.qty_needed,
        r.draft_needed,
        r.qty_issued,
        r.available,
        r.ordered,
        r.draft + r.pending,
        r.received,
        r.suggest,
        r.last_price?.unit_price ?? '',
        r.last_price?.currency ?? '',
        r.last_price && r.suggest > 0 ? r.suggest * r.last_price.unit_price : '',
        dateCell(r.last_price?.at ?? null),
        r.last_price?.supplier_name ?? '',
        BANG_KE_STATUS[r.status].label,
        NGUON[r.source],
        r.pos.map((p) => `${p.code} (${p.supplier_name})`).join('; '),
        r.note ?? '',
      ])
    }
    const bkLast = sb.rowCount
    // Dòng tổng: "bao nhiêu mã còn phải đặt" và "hết bao nhiêu tiền" là hai con
    // số người đọc mang đi làm việc tiếp — đừng bắt họ tự lọc rồi cộng tay.
    // Tiền gộp THEO TỪNG TIỀN TỆ: bảng có cả mã mua VND lẫn USD.
    totalRow(
      sb,
      `Cộng ${bk.rows.length} mã · ${bk.rows.filter((r) => r.suggest > 0).length} mã còn phải đặt`,
      {},
      2,
    )
    const uocTien = estimateByCurrency(bk.rows)
    for (const [cur, tien] of uocTien) {
      totalRow(sb, `Tạm tính phần còn phải đặt (${cur})`, { 16: cur, 17: tien }, 2)
    }
    const chuaCoGia = bk.rows.filter((r) => r.suggest > 0 && !r.last_price).length
    if (chuaCoGia > 0) {
      noteRow(
        sb,
        `${chuaCoGia} mã còn phải đặt CHƯA có giá mua lần nào — tiền tạm tính ở trên chưa gồm những mã đó.`,
        'warn',
      )
    }
    numberCols(sb, [7, 8, 9, 10, 11, 12, 13, 14])
    numberCols(sb, [15], '#,##0.####;-#,##0.####;""')
    numberCols(sb, [17], MONEY_FMT)
    dateCols(sb, [18])
    applyWidths(sb, [
      5, 22, 16, 38, 22, 7, 11, 12, 10, 12, 10, 12, 10, 13, 14, 8, 15, 13, 24, 18, 20, 30,
      24,
    ])
    for (const c of [4, 5, 19, 22, 23]) {
      sb.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
    }
    finishTable(sb, { head: bkHead, lastRow: bkLast, freezeCols: 4 })

    if (bk.blocked.length > 0) {
      sb.addRow([])
      sb.addRow([
        `CHƯA QUY ĐỔI ĐƯỢC SANG ĐƠN VỊ MUA (${bk.blocked.length} dòng định mức) — số của những dòng này KHÔNG nằm trong bảng trên`,
      ]).font = { bold: true }
      headerRow(sb, [
        'Mã VT',
        'Tên vật tư',
        'ĐVT mua',
        'Sản phẩm',
        'Chi tiết',
        'Vì sao chưa tính được',
      ])
      for (const b of bk.blocked) {
        sb.addRow([
          b.material_code,
          b.material_name,
          b.unit,
          b.product_code,
          b.part_name,
          b.reason,
        ])
      }
    }

    // ── Sheet phụ: VẬT TƯ DÙNG CHO SẢN PHẨM NÀO ──────────────────────────
    const rowsWithProducts = bk.rows.filter((r) => r.from_products.length > 0)
    if (rowsWithProducts.length > 0) {
      const sp = wb.addWorksheet('Phân bổ theo SP')
      titleRow(sp, `VẬT TƯ DÙNG CHO SẢN PHẨM NÀO — LSX ${lsx.code}`)
      noteRow(
        sp,
        'Cột "Định mức/SP" đã quy đổi sang đơn vị mua; cột "Cách tính" nói rõ phép quy đổi.',
      )
      sp.addRow([])
      const spHead = headerRow(sp, [
        'Mã VT',
        'Tên vật tư',
        'ĐVT',
        'Mã SP',
        'Tên sản phẩm',
        'SL sản phẩm',
        'Định mức/SP',
        'Tổng cần',
        'Cách tính',
        'BOM đã xác nhận',
      ])
      for (const r of rowsWithProducts) {
        for (const p of r.from_products) {
          sp.addRow([
            r.material_code,
            r.material_name,
            r.unit,
            p.code,
            p.name,
            p.qty,
            p.per,
            p.per * p.qty,
            p.explain ?? '',
            p.confirmed ? 'Đã xác nhận' : 'CHƯA',
          ])
        }
      }
      numberCols(sp, [6, 7, 8], '#,##0.####;-#,##0.####;""')
      applyWidths(sp, [16, 34, 7, 16, 34, 12, 12, 16, 32, 16])
      for (const c of [2, 5, 9]) {
        sp.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
      }
      finishTable(sp, { head: spHead, freezeCols: 1 })
    }
  }

  if (kind === 'bangke') {
    const out = await wb.xlsx.writeBuffer()
    return Buffer.from(out as ArrayBuffer)
  }

  // ── Sheet 2: ĐƠN MUA CỦA LỆNH (khuôn Thao_THĐH) ───────────────────────
  const s2 = wb.addWorksheet('Đơn mua')
  const s2Head = headerRow(s2, [
    'STT',
    'Số đơn',
    'Nhà cung cấp',
    'Số ĐH của NCC',
    'Nhóm VT chính',
    'Ngày đặt',
    'Hẹn giao',
    'Về thực tế',
    'Trạng thái',
    'Hành động cần làm',
    'Số dòng',
    'SL đặt',
    'SL đã nhận',
    '% nhận',
    'Số mã còn thiếu',
    'Tiền hàng',
    'Đã trả',
    'Còn nợ',
    'Tiền tệ',
    'Người theo dõi',
    'Mua chung với',
    'Ghi chú',
  ])
  let stt = 0
  for (const p of lsx.pos) {
    stt++
    s2.addRow([
      stt,
      p.code,
      p.supplier_name,
      p.supplier_doc_no ?? '',
      p.material_group ?? '',
      dateCell(p.ordered_at),
      dateCell(p.expected_at),
      dateCell(p.received_at),
      statusLabel(p.status),
      hanhDong(p),
      p.line_count,
      p.qty_ordered,
      p.qty_received,
      p.qty_ordered > 0 ? p.qty_received / p.qty_ordered : '',
      p.lines_missing,
      p.amount,
      p.paid,
      p.amount - p.paid,
      p.currency,
      p.assignee_name ?? '',
      p.shared_with.join(', '),
      p.note ?? '',
    ])
  }
  if (stt === 0) s2.addRow(['— Lệnh chưa có đơn mua nào —'])
  const s2Last = s2.rowCount
  if (stt > 0) {
    // Cộng tiền THEO TỪNG TIỀN TỆ — cộng thẳng VND với USD là ra một con số
    // không có nghĩa gì. Đơn nhiều tiền tệ thì bày mỗi loại một dòng.
    const byCur = new Map<string, { amount: number; paid: number }>()
    for (const p of lsx.pos) {
      const cur = byCur.get(p.currency) ?? { amount: 0, paid: 0 }
      cur.amount += p.amount
      cur.paid += p.paid
      byCur.set(p.currency, cur)
    }
    for (const [cur, v] of byCur) {
      totalRow(
        s2,
        `Cộng tiền (${cur})`,
        { 16: v.amount, 17: v.paid, 18: v.amount - v.paid, 19: cur },
        3,
      )
    }
  }
  numberCols(s2, [14], PCT_FMT)
  numberCols(s2, [12, 13])
  numberCols(s2, [16, 17, 18], MONEY_FMT)
  dateCols(s2, [6, 7, 8])
  applyWidths(
    s2,
    [5, 16, 26, 14, 14, 11, 11, 11, 14, 28, 8, 10, 11, 8, 9, 14, 13, 13, 7, 16, 16, 28],
  )
  for (const c of [3, 10, 21, 22]) {
    s2.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
  }
  finishTable(s2, { head: s2Head, lastRow: s2Last, freezeCols: 2 })

  // ── Sheet 3..n: TỪNG ĐƠN, từng dòng vật tư, nhận theo đợt ─────────────
  for (const p of lsx.pos) {
    const ws = wb.addWorksheet(sheetName('ĐH', p.code, taken))
    const lines = report.lines[p.id] ?? []
    const batches = report.batches[p.id] ?? []

    titleRow(ws, `ĐƠN ĐẶT HÀNG ${p.code} — ${p.supplier_name}`)
    noteRow(ws, `Cho LSX ${lsx.code} · ${lsx.customer_name}`)
    kv(ws, 'Số ĐH của NCC', p.supplier_doc_no ?? '')
    kv(ws, 'Trạng thái', statusLabel(p.status))
    kv(ws, 'Ngày đặt', fmtD(p.ordered_at))
    kv(ws, 'Hẹn giao', fmtD(p.expected_at))
    kv(ws, 'Về thực tế (gần nhất)', fmtD(p.received_at))
    kv(ws, 'Người theo dõi', p.assignee_name ?? '')
    kv(ws, 'Tiền hàng', `${p.amount.toLocaleString('vi-VN')} ${p.currency}`)
    if (p.shared_with.length > 0) kv(ws, 'Mua chung với', p.shared_with.join(', '))
    if (p.note) kv(ws, 'Ghi chú', p.note)
    ws.addRow([])

    const fixed = [
      'STT',
      'Mã VT',
      'Tên vật tư',
      'Quy cách',
      'ĐVT',
      'SL đặt',
      'SL2',
      'ĐVT2',
      'Đơn giá',
      'Thành tiền',
    ]
    const batchCols = batches.flatMap((b, i) => [
      `Đợt ${i + 1} (${fmtD(b.date)})${b.supplier_doc_no ? ` · ${b.supplier_doc_no}` : ''} — nhận`,
      `Đợt ${i + 1} — loại QC`,
    ])
    const tail = [
      'Tổng đã nhận',
      'Loại QC',
      'Còn thiếu',
      'Kết luận',
      'Nhận gần nhất',
      'Ghi chú',
    ]
    const head = headerRow(ws, [...fixed, ...batchCols, ...tail])

    let i = 0
    for (const l of lines) {
      i++
      const perBatch = batches.flatMap((b) => {
        const r = b.by_line[l.id]
        return [r?.qty ?? '', r?.rejected ? r.rejected : '']
      })
      const ketLuan =
        l.closed_short_at != null
          ? `Chốt thiếu ${l.qty_missing}`
          : l.qty_missing > 0
            ? l.qty_received > 0
              ? `Thiếu ${l.qty_missing}`
              : 'Chưa về'
            : l.qty_missing < 0
              ? `Dư ${-l.qty_missing}`
              : 'Đủ'
      ws.addRow([
        i,
        l.material_code,
        l.material_name,
        l.spec ?? '',
        l.unit,
        l.qty_ordered,
        l.qty2 ?? '',
        l.unit2 ?? '',
        l.unit_price ?? '',
        l.unit_price != null ? l.unit_price * l.qty_ordered : '',
        ...perBatch,
        l.qty_received,
        l.qty_rejected,
        l.qty_missing,
        ketLuan,
        dateCell(l.last_received_at),
        l.note ?? '',
      ])
    }
    if (lines.length === 0) ws.addRow(['— Đơn chưa có dòng vật tư —'])
    const lineLast = ws.rowCount
    if (lines.length > 0) {
      // Tổng cộng — cộng các cột số lượng khác đơn vị đếm là vô nghĩa (500 con
      // + 3 kg), nên chỉ SUM tiền.
      totalRow(
        ws,
        `Cộng tiền hàng (${p.currency})`,
        {
          10: lines.reduce(
            (s, l) => s + (l.unit_price != null ? l.unit_price * l.qty_ordered : 0),
            0,
          ),
        },
        3,
      )
    }
    const nCols = head.cellCount
    numberCols(ws, [6, 7])
    numberCols(ws, [9], '#,##0.##')
    numberCols(ws, [10], MONEY_FMT)
    // Cột đợt nhận + tổng nhận/loại/thiếu: từ 11 tới hết, trừ ba cột chữ cuối.
    numberCols(
      ws,
      Array.from({ length: nCols - 3 - 10 }, (_, k) => 11 + k),
    )
    dateCols(ws, [nCols - 1])
    applyWidths(ws, [5, 14, 34, 22, 7, 9, 9, 7, 12, 14], 12)
    for (const c of [3, 4, nCols]) {
      ws.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
    }
    finishTable(ws, { head, lastRow: lineLast, freezeCols: 3 })
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
