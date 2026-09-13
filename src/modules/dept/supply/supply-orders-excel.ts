import ExcelJS from 'exceljs'
import { PO_STATUS_LABEL, isPoStatus } from '@/lib/po-status'
import {
  MEETING_LEVEL,
  MEETING_LEVELS,
  PO_SENT,
  agendaDeptRank,
  buildAgenda,
  type MeetingRow,
} from '@/lib/supply-meeting'
import type { LsxSupplyRow } from './lsx-supply.service'
import { addPoDetailSheet } from './lsx-detail-excel'
import type { SupplyOrdersPo, SupplyOrdersReport } from './supply-orders-report.service'
import {
  ACCENT,
  DATE_FMT,
  MONEY_FMT,
  PCT_FMT,
  applyWidths,
  dateCell,
  dateCols,
  finishTable,
  groupRow,
  headerRow,
  numberCols,
  stampWorkbook,
  totalRow,
} from './excel-kit'

/**
 * BÁO CÁO ĐƠN HÀNG THEO LỆNH SẢN XUẤT — file .xlsx cho họp sản xuất, một khuôn
 * cho cả hai phạm vi (mọi lệnh / một lệnh).
 *
 * BỐ CỤC (user chốt 13/09/2026 sau hai bản bị chê "xấu", "nội dung bị đẩy
 * xuống, không xem được"): mỗi tờ chỉ có MỘT bảng, và mọi thứ phía trên bảng
 * phải xếp theo đúng lưới cột của bảng đó. Bản trước đặt khối chỉ tiêu xếp
 * DỌC ở cột A–C, trong khi bề rộng cột A đã dành cho cột STT của bảng bên dưới
 * → nhãn bị cắt còn "Lệnh đ". Bài học: trên một tờ Excel, bề rộng cột là của
 * cả tờ, hai bảng khác bố cục thì bảng nào cũng xấu.
 *
 *  1. "Tổng hợp": 4 dòng đầu tờ (công ty · tên báo cáo · phạm vi/ngày lập) →
 *     DẢI CHỈ TIÊU NGANG (nhãn trên, số dưới, mỗi chỉ tiêu một cột của bảng;
 *     nghĩa của chỉ tiêu nằm trong ghi chú ô) → bảng đơn hàng GOM THEO LỆNH
 *     từ dòng 7: mỗi lệnh một dòng khối (khách · mốc · mức · vì sao), dưới là
 *     từng đơn; cộng tiền theo lệnh và theo tiền tệ.
 *  2. "Tình trạng lệnh": dải 5 mức ngang → mỗi lệnh một dòng theo thang họp.
 *  3. "Việc cần quyết định": để chép biên bản, hai cột trống ghi tay.
 *  4. "ĐH <mã>": MỖI ĐƠN MỘT TỜ — hai dòng thông tin đơn rồi vào thẳng bảng
 *     dòng vật tư + đợt nhận (cùng tờ với hồ sơ một lệnh).
 *
 * Số ở mọi tờ cùng nguồn với màn hình (`buildMeeting`, `loadPoReportDetails`,
 * `supply_po_line_status`) — không có phép cộng nào riêng của file.
 */

/** dd/mm/yyyy — toLocaleDateString vi-VN cho "13/9/2026" thiếu số 0, đọc lệch cột. */
const fmtD = (iso: string | null) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

const MUTED = 'FF6B7280'

function statusLabel(status: string): string {
  return isPoStatus(status) ? PO_STATUS_LABEL[status] : status
}

/** Câu NÓI VIỆC cho từng đơn — cùng lời với màn hình. */
function hanhDong(p: { status: string; late: boolean }): string {
  if (p.status === 'draft') return 'Hoàn thiện đơn rồi trình ký'
  if (p.status === 'pending_approval') return 'Chờ duyệt — nhắc người ký'
  if (p.status === 'approved') return 'Đã duyệt, chưa gửi NCC'
  if (p.status === 'cancelled') return ''
  if (p.late) return 'Quá hẹn — giục nhà cung cấp'
  if (p.status === 'partial') return 'Về chưa đủ — bám phần còn lại'
  return 'Không cần xử lý'
}

/** Nghĩa của từng mức — ghi chú ô, không chiếm cột. */
const NGHIA: Record<string, string> = {
  stop: 'Vật tư chưa đủ mà mốc còn ≤ 3 ngày hoặc đã qua.',
  warn: 'Chưa lập đơn, đơn còn nháp/chờ ký, hoặc NCC đã trễ hẹn.',
  watch: 'Lệnh không có hạn vật tư lẫn ngày xuất — chưa đo được rủi ro.',
  inflight: 'Đơn đã gửi, đang chờ hàng về đúng hẹn.',
  ready: 'Kho đã xác nhận đủ hoặc mọi đơn đã nhận xong.',
}

function sentLate(pos: { status: string; late: boolean }[]): number {
  return pos.filter((p) => p.late && PO_SENT.has(p.status)).length
}

function mocLa(m: MeetingRow<LsxSupplyRow>): string {
  if (!m.risk.due) return 'Chưa có mốc'
  return m.risk.due.source === 'materials_due_at' ? 'Hạn vật tư' : 'Ngày xuất (mượn)'
}

/** Cộng tiền theo TIỀN TỆ — VND cộng với USD là một con số vô nghĩa. */
function tienTheoTienTe(
  pos: SupplyOrdersPo[],
): Map<string, { amount: number; paid: number }> {
  const out = new Map<string, { amount: number; paid: number }>()
  for (const p of pos) {
    if (p.status === 'cancelled') continue
    const cur = out.get(p.currency) ?? { amount: 0, paid: 0 }
    cur.amount += p.amount
    cur.paid += p.paid
    out.set(p.currency, cur)
  }
  return out
}

/** Một dòng chữ kéo ngang cả bảng — không bị bề rộng cột A cắt. */
function wideRow(
  ws: ExcelJS.Worksheet,
  text: string,
  lastCol: number,
  font: Partial<ExcelJS.Font> = {},
): ExcelJS.Row {
  const r = ws.addRow([text])
  ws.mergeCells(r.number, 1, r.number, lastCol)
  r.getCell(1).font = font
  r.getCell(1).alignment = { vertical: 'middle' }
  return r
}

/**
 * Bốn dòng đầu tờ, kéo ngang cả bảng: công ty · địa chỉ/MST/SĐT · TÊN BÁO CÁO
 * · phạm vi + ngày lập + người lập. Không nhiều hơn: mỗi dòng ở đây là một
 * dòng bảng bị đẩy xuống.
 */
function dauTo(
  ws: ExcelJS.Worksheet,
  r: SupplyOrdersReport,
  ten: string,
  lastCol: number,
) {
  const c = r.company
  wideRow(ws, (c.company_name || 'Công ty').toUpperCase(), lastCol, {
    bold: true,
    size: 11,
  })
  const lienHe = [
    c.company_address && `Địa chỉ: ${c.company_address}`,
    c.company_tax_code && `MST: ${c.company_tax_code}`,
    c.company_phone && `SĐT: ${c.company_phone}`,
  ]
    .filter(Boolean)
    .join(' · ')
  wideRow(ws, lienHe || '', lastCol, { size: 9, color: { argb: MUTED } })
  const t = wideRow(ws, ten, lastCol, { bold: true, size: 14 })
  t.height = 24
  const phamVi =
    r.scope.kind === 'all'
      ? `Phạm vi: mọi lệnh đang chạy (${r.scope.total} lệnh)`
      : `Phạm vi: lệnh ${r.scope.code} · ${r.scope.customer_name}`
  wideRow(
    ws,
    `${phamVi} · Ngày lập: ${fmtD(r.today)} · Người lập: ${r.prepared_by}`,
    lastCol,
    { size: 10, color: { argb: MUTED } },
  )
}

type Kpi = { col: number; label: string; value: number; note?: string; money?: boolean }

/**
 * DẢI CHỈ TIÊU NGANG: hai dòng, nhãn trên số dưới, mỗi chỉ tiêu nằm ở một cột
 * CỦA BẢNG (col) — nên bề rộng cột không cắt gì. Nghĩa của chỉ tiêu để trong
 * ghi chú ô (rê chuột thấy) thay vì chiếm thêm cột.
 */
function daiChiTieu(ws: ExcelJS.Worksheet, items: Kpi[]): void {
  const lab = ws.addRow([])
  const val = ws.addRow([])
  lab.height = 28
  val.height = 22
  for (const it of items) {
    const lc = lab.getCell(it.col)
    lc.value = it.label
    lc.font = { size: 9, color: { argb: MUTED } }
    lc.alignment = { wrapText: true, vertical: 'bottom' }
    if (it.note) lc.note = it.note
    const vc = val.getCell(it.col)
    vc.value = it.value
    vc.font = { bold: true, size: it.money ? 11 : 14 }
    vc.numFmt = it.money ? MONEY_FMT : '#,##0'
    vc.alignment = { horizontal: 'left', vertical: 'middle' }
    for (const cell of [lc, vc]) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACCENT } }
    }
  }
}

export async function buildSupplyOrdersExcel(r: SupplyOrdersReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(
    wb,
    r.scope.kind === 'all'
      ? `Báo cáo đơn hàng theo LSX — ${fmtD(r.today)}`
      : `Báo cáo đơn hàng — LSX ${r.scope.code}`,
  )
  const taken = new Set<string>()
  const allPos = r.lsx.flatMap((l) => l.pos)
  // Đơn mua chung nằm ở nhiều lệnh — mọi phép đếm đơn chỉ đếm một lần.
  const uniquePos = [...new Map(allPos.map((p) => [p.id, p])).values()]
  const live = uniquePos.filter((p) => p.status !== 'cancelled')

  // ── Tờ 1: TỔNG HỢP ───────────────────────────────────────────────────────
  const COLS = [
    'STT',
    'Số đơn',
    'Nhà cung cấp',
    'Số ĐH của NCC',
    'Nhóm VT',
    'Ngày đặt',
    'Hẹn giao',
    'Về thực tế',
    'Trạng thái',
    'Số dòng',
    'SL đặt',
    'SL đã nhận',
    '% nhận',
    'Còn thiếu (mã)',
    'Tiền hàng',
    'Đã trả',
    'Còn nợ',
    'Tiền tệ',
    'Người theo dõi',
    'Việc cần làm',
    'Ghi chú',
  ]
  const nCols = COLS.length
  const s1 = wb.addWorksheet('Tổng hợp')
  taken.add('Tổng hợp')
  // Bề rộng đặt TRƯỚC, vì mọi thứ phía trên bảng xếp theo lưới này.
  applyWidths(
    s1,
    [5, 18, 26, 14, 14, 11, 11, 11, 14, 7, 10, 11, 8, 9, 14, 13, 13, 7, 16, 28, 30],
  )
  dauTo(s1, r, 'BÁO CÁO ĐƠN HÀNG THEO LỆNH SẢN XUẤT', nCols)

  const kpis: Kpi[] = [
    { col: 2, label: 'Lệnh đang chạy', value: r.lsx.length },
    {
      col: 3,
      label: 'Cần nêu trong họp',
      value: r.issues,
      note: 'Lệnh ở mọi mức trừ Đang về và Đủ vật tư.',
    },
    { col: 4, label: 'Đơn mua', value: live.length, note: 'Không tính đơn đã huỷ.' },
    {
      col: 5,
      label: 'Chưa gửi NCC',
      value: live.filter((p) => p.status === 'draft' || p.status === 'pending_approval')
        .length,
      note: 'Đơn còn nháp hoặc chờ ký.',
    },
    {
      col: 6,
      label: 'Đang về',
      value: live.filter((p) => PO_SENT.has(p.status) || p.status === 'approved').length,
      note: 'Đã duyệt / đã gửi, chưa nhận đủ.',
    },
    {
      col: 7,
      label: 'Đã nhận đủ',
      value: live.filter((p) => p.status === 'received').length,
    },
    {
      col: 8,
      label: 'NCC quá hẹn',
      value: sentLate(live),
      note: 'Chỉ đếm đơn đã gửi nhà cung cấp.',
    },
  ]
  // Tiền theo tiền tệ đặt đúng CỘT TIỀN của bảng (15–17), tiền tệ thứ hai ở 19–21.
  const tien = [...tienTheoTienTe(uniquePos)]
  tien.slice(0, 2).forEach(([cur, v], i) => {
    const base = i === 0 ? 15 : 19
    kpis.push(
      { col: base, label: `Tiền hàng (${cur})`, value: v.amount, money: true },
      { col: base + 1, label: `Đã trả (${cur})`, value: v.paid, money: true },
      { col: base + 2, label: `Còn nợ (${cur})`, value: v.amount - v.paid, money: true },
    )
  })
  daiChiTieu(s1, kpis)

  const head = headerRow(s1, COLS)
  let stt = 0
  for (const l of r.lsx) {
    const row = l.row
    const moc = l.risk.due
      ? `${l.risk.due.source === 'materials_due_at' ? 'hạn vật tư' : 'ngày xuất'} ${fmtD(l.risk.due.date)}`
      : 'chưa có mốc'
    groupRow(
      s1,
      `LSX ${row.code} · ${row.customer_name} · ${moc} · ${l.risk.label}: ${l.risk.reason}`,
      nCols,
    )
    if (l.pos.length === 0) {
      groupRow(s1, '— chưa có đơn mua nào —', nCols, { sub: true })
      continue
    }
    for (const p of l.pos) {
      stt++
      s1.addRow([
        stt,
        p.code + (p.shared ? ' (mua chung)' : ''),
        p.supplier_name,
        p.supplier_doc_no ?? '',
        p.material_group ?? '',
        dateCell(p.ordered_at),
        dateCell(p.expected_at),
        dateCell(p.received_at),
        statusLabel(p.status),
        p.line_count,
        p.qty_ordered || '',
        p.qty_received || '',
        p.qty_ordered > 0 ? p.qty_received / p.qty_ordered : '',
        p.lines_missing || '',
        p.amount,
        p.paid,
        p.amount - p.paid,
        p.currency,
        p.assignee_name ?? '',
        hanhDong(p),
        [
          p.note,
          p.shared_with.length > 0 ? `mua chung với ${p.shared_with.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      ])
    }
    for (const [cur, v] of tienTheoTienTe(l.pos)) {
      totalRow(
        s1,
        `Cộng ${row.code} (${cur})`,
        { 15: v.amount, 16: v.paid, 17: v.amount - v.paid, 18: cur },
        2,
      )
    }
  }
  if (r.lsx.length === 0) s1.addRow(['— Không có lệnh sản xuất nào đang chạy —'])
  const bodyLast = s1.rowCount
  for (const [cur, v] of tien) {
    totalRow(
      s1,
      `TỔNG CỘNG (${cur})`,
      { 15: v.amount, 16: v.paid, 17: v.amount - v.paid, 18: cur },
      2,
    )
  }
  // numberCols đè numFmt lên cả cột, kể cả ô chỉ tiêu phía trên — nên chỉ đặt
  // theo ô trong vùng dữ liệu.
  const setFmt = (cols: number[], fmt: string) => {
    for (let i = head.number + 1; i <= s1.rowCount; i++) {
      for (const c of cols) s1.getRow(i).getCell(c).numFmt = fmt
    }
  }
  setFmt([10, 11, 12, 14], '#,##0')
  setFmt([13], PCT_FMT)
  setFmt([15, 16, 17], MONEY_FMT)
  // Ngày cũng theo ô: dateCols đặt ở mức cột thì ô chỉ tiêu phía trên (cùng
  // cột 6–8) hoá thành ngày 1899.
  setFmt([6, 7, 8], DATE_FMT)
  for (const c of [3, 20, 21])
    s1.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
  // Có dòng khối theo lệnh → tắt lọc tự động (lọc sẽ giấu dòng khối, mất ngữ cảnh).
  finishTable(s1, { head, lastRow: bodyLast, freezeCols: 2, autoFilter: false })

  // ── Tờ 2: TÌNH TRẠNG LỆNH ────────────────────────────────────────────────
  const COLS2 = [
    'Mức',
    'Lệnh SX',
    'Khách hàng',
    'Sản phẩm',
    'Mốc',
    'Mốc là',
    'Còn (ngày)',
    'Vì sao',
    'Ai cầm bóng',
    'Việc phải làm',
    'Sản xuất cần quyết',
    'Hàng về gần nhất',
    'Số đơn',
    'Chưa gửi',
    'Đang về',
    'NCC trễ hẹn',
    'Chưa có hẹn giao',
  ]
  const s2 = wb.addWorksheet('Tình trạng lệnh')
  taken.add('Tình trạng lệnh')
  applyWidths(s2, [16, 20, 18, 36, 11, 15, 9, 44, 13, 34, 30, 12, 8, 9, 9, 10, 10])
  wideRow(s2, `TÌNH TRẠNG VẬT TƯ THEO LỆNH — ${fmtD(r.today)}`, COLS2.length, {
    bold: true,
    size: 14,
  })
  wideRow(
    s2,
    `${r.lsx.length} lệnh · ${r.issues} lệnh cần nêu trong họp · mốc mượn từ ngày xuất khi lệnh chưa đặt hạn vật tư`,
    COLS2.length,
    { size: 10, color: { argb: MUTED } },
  )
  daiChiTieu(s2, [
    ...MEETING_LEVELS.map((k, i) => ({
      col: i + 1,
      label: MEETING_LEVEL[k].label,
      value: r.counts[k],
      note: NGHIA[k],
    })),
    { col: 6, label: 'Tổng', value: r.lsx.length },
  ])
  const s2Head = headerRow(s2, COLS2)
  for (const l of r.lsx) {
    const x = { row: l.row, risk: l.risk }
    // Ba mã đầu + "+n": danh sách đầy đủ ở tờ Tổng hợp / màn lệnh.
    const sp = l.row.products.slice(0, 3).map((p) => `${p.code} x${p.qty}`)
    if (l.row.products.length > 3) sp.push(`+${l.row.products.length - 3} mã`)
    s2.addRow([
      l.risk.label,
      l.row.code,
      l.row.customer_name,
      sp.join(', '),
      dateCell(l.risk.due?.date ?? null),
      mocLa(x),
      l.risk.daysLeft ?? '',
      l.risk.reason,
      l.risk.owner === '—' ? '' : l.risk.owner,
      l.risk.action,
      l.risk.decision ?? '',
      dateCell(l.risk.nextExpected),
      l.row.posTotal,
      l.row.posUnsent,
      l.row.posOpen,
      sentLate(l.row.pos),
      l.risk.posNoEta,
    ])
  }
  if (r.lsx.length === 0) s2.addRow(['— Không có lệnh sản xuất nào đang chạy —'])
  for (let i = s2Head.number + 1; i <= s2.rowCount; i++) {
    for (const c of [7, 13, 14, 15, 16, 17]) s2.getRow(i).getCell(c).numFmt = '#,##0'
    for (const c of [5, 12]) s2.getRow(i).getCell(c).numFmt = DATE_FMT
  }
  for (const c of [4, 8, 10, 11])
    s2.getColumn(c).alignment = { wrapText: true, vertical: 'top' }
  finishTable(s2, { head: s2Head, freezeCols: 2 })

  // ── Tờ 3: VIỆC CẦN QUYẾT ĐỊNH ────────────────────────────────────────────
  const s3 = wb.addWorksheet('Việc cần quyết định')
  taken.add('Việc cần quyết định')
  applyWidths(s3, [14, 40, 20, 18, 16, 11, 9, 16, 11])
  wideRow(s3, `VIỆC CẦN QUYẾT ĐỊNH TRONG HỌP — ${fmtD(r.today)}`, 9, {
    bold: true,
    size: 14,
  })
  wideRow(
    s3,
    'Tự sinh từ tình trạng lệnh, gom theo bộ phận rồi theo việc. Hai cột cuối để trống cho người chủ trì ghi tay.',
    9,
    { size: 10, color: { argb: MUTED } },
  )
  const s3Head = headerRow(s3, [
    'Bộ phận',
    'Việc',
    'Lệnh SX',
    'Khách hàng',
    'Mức',
    'Mốc',
    'Còn (ngày)',
    'Người xử lý',
    'Hạn',
  ])
  const agenda = [...buildAgenda(r.lsx.map((l) => ({ row: l.row, risk: l.risk })))].sort(
    (a, b) =>
      agendaDeptRank(a.dept) - agendaDeptRank(b.dept) ||
      a.rank - b.rank ||
      b.rows.length - a.rows.length,
  )
  let n = 0
  for (const it of agenda) {
    for (const x of it.rows) {
      n++
      s3.addRow([
        it.dept,
        it.action,
        x.row.code,
        x.row.customer_name,
        x.risk.label,
        dateCell(x.risk.due?.date ?? null),
        x.risk.daysLeft ?? '',
        '',
        '',
      ])
    }
  }
  if (n === 0) {
    s3.addRow([
      '— Không có việc gì cần quyết: mọi lệnh đã đủ vật tư hoặc đang về đúng hẹn —',
    ])
  }
  numberCols(s3, [7])
  dateCols(s3, [6])
  s3.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
  finishTable(s3, { head: s3Head, freezeCols: 2 })

  // ── Tờ 4..n: MỖI ĐƠN MỘT TỜ — theo thứ tự lệnh, đơn mua chung chỉ một tờ ──
  const seen = new Set<string>()
  for (const l of r.lsx) {
    for (const p of l.pos) {
      if (seen.has(p.id)) continue
      seen.add(p.id)
      addPoDetailSheet(
        wb,
        taken,
        p,
        { code: l.row.code, customer_name: l.row.customer_name },
        r.lines[p.id] ?? [],
        r.batches[p.id] ?? [],
      )
    }
  }

  const out = await wb.xlsx.writeBuffer()
  return Buffer.from(out as ArrayBuffer)
}
