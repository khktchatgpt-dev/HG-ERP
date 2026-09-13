import ExcelJS from 'exceljs'
import {
  DATE_FMT,
  MONEY_FMT,
  NUM_FMT,
  applyWidths,
  dateCell,
  finishTable,
  headerRow,
  noteRow,
  stampWorkbook,
  titleRow,
} from '@/modules/dept/supply/excel-kit'
import { STAGE_META, type FunnelStage } from '@/lib/finance-funnel'
import { BUCKETS, BUCKET_LABEL } from '@/lib/ap-aging'
import type { FinanceReport } from './finance-report.service'
import type { LsxFinanceScreenRow } from './lsx-finance.service'
import type { ApAgingResult } from './ap-aging.service'

/**
 * XUẤT EXCEL BÁO CÁO TÀI CHÍNH (phía chi).
 *
 * Bốn sheet, mỗi sheet trả lời một câu:
 *   Phễu      — tiền mua đang nằm ở mốc nào
 *   Theo lệnh — lệnh nào đã trót cam kết bao nhiêu
 *   Theo NCC  — ước tính sẽ phải trả ai bao nhiêu
 *   Tuổi nợ   — nợ nào quá hạn bao lâu
 *
 * ⭐ ĐƠN NHÁP VẪN TÍNH vào cam kết, và file có CỘT RIÊNG "trong đó nháp".
 * Người nhận file cần thấy cả hai: tổng để lập kế hoạch, phần nháp để biết bao
 * nhiêu trong đó còn có thể thay đổi.
 *
 * ⭐ TIỀN TỆ KHÔNG QUY ĐỔI. Mỗi dòng mang cột tiền tệ riêng; không có dòng
 * "tổng cộng tất cả" trộn VND với USD — trong Excel người ta hay bôi đen cả cột
 * rồi xem SUM ở thanh trạng thái, nên trộn hai tiền tệ trong một cột là đặt bẫy.
 *
 * Dùng `excel-kit` của Cung ứng: ngày là ô NGÀY thật, số là ô SỐ thật (0 hiện
 * trống nhưng vẫn là số), có lọc tự động + ghim tiêu đề + đặt trang in.
 */

/** Phần trăm một chữ số thập phân; 0 hiện trống nhưng ô VẪN là số. */
const PCT1 = '0.0"%";;""'

const STAGES: FunnelStage[] = ['committed', 'confirmed', 'received', 'invoiced', 'paid']

export type FinanceExcelInput = {
  report: FinanceReport
  lsx: { rows: LsxFinanceScreenRow[]; currency: string }[]
  aging: ApAgingResult
  today: string
}

export function financeExcelFilename(today: string): string {
  return `Bao cao tai chinh mua hang ${today.slice(8, 10)}-${today.slice(5, 7)}-${today.slice(0, 4)}.xlsx` // prettier-ignore
}

export async function buildFinanceExcel(input: FinanceExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, 'Báo cáo tài chính mua hàng')

  sheetFunnel(wb, input)
  sheetLsx(wb, input)
  sheetSupplier(wb, input)
  sheetAging(wb, input)
  sheetSpend(wb, input)

  // exceljs khai trả ArrayBuffer-ish; route cần Uint8Array nên Buffer.from là
  // đường an toàn, không ép kiểu chéo.
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/* ── 1. Phễu dòng tiền ─────────────────────────────────────────────────── */
function sheetFunnel(wb: ExcelJS.Workbook, { report, today }: FinanceExcelInput): void {
  const ws = wb.addWorksheet('Phễu dòng tiền')
  titleRow(ws, 'DÒNG TIỀN MUA HÀNG — TIỀN ĐANG NẰM Ở ĐÂU')
  noteRow(ws, `Số liệu lúc ${dmy(today)}`)
  noteRow(
    ws,
    'Hai mốc đầu (Đã cam kết, NCC đã xác nhận) là ƯỚC TÍNH để lập kế hoạch chi — KHÔNG ghi sổ được. Nợ phải trả chỉ phát sinh từ mốc "Đã về kho".',
    'warn',
  )
  noteRow(ws, 'Đơn NHÁP VẪN được tính vào "Đã cam kết".', 'warn')
  ws.addRow([])

  const head = headerRow(ws, ['Mốc', 'Loại', ...report.funnel.map((f) => f.currency), 'Ghi chú']) // prettier-ignore
  for (const s of STAGES) {
    const m = STAGE_META[s]
    const row = ws.addRow([
      m.label,
      m.kind === 'uoc_tinh' ? 'ƯỚC TÍNH' : 'Ghi sổ được',
      ...report.funnel.map((f) => f[s]),
      m.hint,
    ])
    if (m.kind === 'uoc_tinh') row.getCell(2).font = { bold: true, color: { argb: 'FFB45309' } } // prettier-ignore
    report.funnel.forEach((_, i) => {
      row.getCell(3 + i).numFmt = MONEY_FMT
    })
  }
  ws.addRow([])
  const gaps: [string, keyof (typeof report.funnel)[number]][] = [
    ['Chưa được xác nhận', 'unconfirmed'],
    ['Đã xác nhận, chưa về', 'in_flight'],
    ['Đã về, chưa có hoá đơn', 'awaiting_invoice'],
    ['Có hoá đơn, chưa trả', 'unpaid'],
  ]
  for (const [label, key] of gaps) {
    const row = ws.addRow([label, '', ...report.funnel.map((f) => Number(f[key]))])
    report.funnel.forEach((_, i) => {
      row.getCell(3 + i).numFmt = MONEY_FMT
    })
  }
  applyWidths(ws, [26, 14, ...report.funnel.map(() => 20), 46])
  finishTable(ws, { head, autoFilter: false, landscape: true })
}

/* ── 2. Tiền theo lệnh sản xuất ────────────────────────────────────────── */
function sheetLsx(wb: ExcelJS.Workbook, { lsx, today }: FinanceExcelInput): void {
  const ws = wb.addWorksheet('Theo lệnh SX')
  titleRow(ws, 'TIỀN MUA HÀNG THEO LỆNH SẢN XUẤT')
  noteRow(ws, `Số liệu lúc ${dmy(today)} · đơn đã huỷ KHÔNG tính`)
  noteRow(
    ws,
    'Cột "Trong đó NHÁP" nằm TRONG cột "Đã cam kết", không cộng thêm. Mỗi dòng một tiền tệ — không quy đổi, không cộng chéo.',
    'warn',
  )
  ws.addRow([])

  const head = headerRow(ws, [
    'Lệnh SX',
    'Khách',
    'Tiền tệ',
    'Số đơn',
    'Đã cam kết',
    'Trong đó NHÁP',
    'NCC đã xác nhận',
    'Đã về kho',
    'Chưa về',
    'NCC đã đòi',
    'Chờ hoá đơn',
    'Dòng lệch',
  ])
  for (const g of lsx) {
    for (const r of g.rows) {
      const row = ws.addRow([
        r.code,
        r.customer_name ?? '',
        g.currency,
        r.po_count,
        r.committed,
        r.draft,
        r.confirmed,
        r.received,
        r.not_received,
        r.invoiced,
        r.awaiting_invoice,
        r.issue_count,
      ])
      for (let c = 5; c <= 11; c++) row.getCell(c).numFmt = MONEY_FMT
      row.getCell(4).numFmt = NUM_FMT
      row.getCell(12).numFmt = NUM_FMT
    }
  }
  applyWidths(ws, [22, 24, 9, 9, 18, 18, 18, 16, 16, 16, 16, 11])
  finishTable(ws, { head, freezeCols: 1, landscape: true })
}

/* ── 3. Ước tính phải trả theo NCC ─────────────────────────────────────── */
function sheetSupplier(wb: ExcelJS.Workbook, { report, today }: FinanceExcelInput): void {
  const ws = wb.addWorksheet('Theo NCC')
  titleRow(ws, 'ƯỚC TÍNH PHẢI TRẢ THEO NHÀ CUNG CẤP')
  noteRow(ws, `Số liệu lúc ${dmy(today)} · nguồn: ĐƠN đã được NCC xác nhận`)
  noteRow(
    ws,
    'ĐÂY LÀ ƯỚC TÍNH, không phải công nợ kế toán — nợ phải trả phát sinh khi hàng về kho hoặc khi có hoá đơn. Đừng ghi sổ theo bảng này.',
    'warn',
  )
  ws.addRow([])

  const head = headerRow(ws, ['Nhà cung cấp', 'Điều khoản TT', 'Tiền tệ', 'Ước tính phát sinh', 'Đã trả', 'Ước tính còn phải trả']) // prettier-ignore
  for (const s of report.suppliers) {
    for (const t of s.totals) {
      const row = ws.addRow([
        s.supplier_name,
        s.payment_terms ?? '',
        t.currency,
        t.incurred,
        t.paid,
        t.balance,
      ])
      for (let c = 4; c <= 6; c++) row.getCell(c).numFmt = MONEY_FMT
    }
  }
  applyWidths(ws, [34, 30, 9, 20, 18, 22])
  finishTable(ws, { head, freezeCols: 1, landscape: false })
}

/* ── 4. Tuổi nợ ────────────────────────────────────────────────────────── */
function sheetAging(wb: ExcelJS.Workbook, { aging }: FinanceExcelInput): void {
  const ws = wb.addWorksheet('Tuổi nợ')
  titleRow(ws, 'TUỔI NỢ NHÀ CUNG CẤP')
  noteRow(
    ws,
    `Số liệu lúc ${dmy(aging.today)} · tuổi tính theo HẠN THANH TOÁN, không theo ngày hoá đơn`,
  )
  if (aging.missing_due > 0) {
    noteRow(ws, `${aging.missing_due} hoá đơn CHƯA khai hạn — nằm ở cột riêng, không phải "chưa đến hạn".`, 'warn') // prettier-ignore
  }
  if (aging.missing_fx.length > 0) {
    noteRow(ws, `Thiếu tỷ giá: ${aging.missing_fx.map((m) => `${m.count} HĐ ${m.currency}`).join(' · ')} — cột Quy VND để TRỐNG, không phải 0.`, 'warn') // prettier-ignore
  }
  noteRow(ws, 'CHƯA trừ thanh toán theo từng hoá đơn (sổ chi mới gắn đơn mua, chưa gắn hoá đơn).', 'warn') // prettier-ignore
  ws.addRow([])

  const head = headerRow(ws, [
    'Nhà cung cấp',
    'Tiền tệ',
    'Số HĐ',
    ...BUCKETS.map((b) => BUCKET_LABEL[b]),
    'Cộng',
    'Quy VND',
    'Quá hạn lâu nhất (ngày)',
  ])
  for (const r of aging.rows) {
    const row = ws.addRow([
      r.supplier_name,
      r.currency,
      r.invoice_count,
      ...BUCKETS.map((b) => r.buckets[b]),
      r.total,
      // null = thiếu tỷ giá → ô TRỐNG THẬT, không phải số 0.
      r.total_base ?? null,
      r.worst_days,
    ])
    row.getCell(3).numFmt = NUM_FMT
    for (let c = 4; c <= 4 + BUCKETS.length + 1; c++) row.getCell(c).numFmt = MONEY_FMT
    row.getCell(4 + BUCKETS.length + 2).numFmt = NUM_FMT
  }
  applyWidths(ws, [34, 9, 8, ...BUCKETS.map(() => 16), 18, 18, 14])
  finishTable(ws, { head, freezeCols: 1, landscape: true })
}

/* ── 5. Phân tích chi ──────────────────────────────────────────────────── */
function sheetSpend(wb: ExcelJS.Workbook, { report, today }: FinanceExcelInput): void {
  const ws = wb.addWorksheet('Phân tích chi')
  titleRow(ws, 'PHÂN TÍCH CHI MUA HÀNG')
  noteRow(ws, `Số liệu lúc ${dmy(today)} · GỒM CẢ đơn nháp`)
  for (const g of report.gaps) noteRow(ws, `${g.label}: ${g.detail}`, 'warn')
  ws.addRow([])

  titleRow(ws, 'Chi theo NHÓM VẬT TƯ', 11)
  if (report.pareto_group) {
    noteRow(ws, `${report.pareto_group.count}/${report.pareto_group.of} nhóm đầu đã chiếm 80% tiền mua`)
  }
  const h1 = headerRow(ws, ['Nhóm vật tư', 'Tiền tệ', 'Số tiền', 'Tỉ lệ %', 'Luỹ kế %', 'Số mã', 'Số dòng'])
  for (const r of report.by_group) {
    const row = ws.addRow([r.label, r.currency, r.amount, r.share, r.cumulative, r.material_count, r.line_count])
    row.getCell(3).numFmt = MONEY_FMT
    for (const c of [4, 5]) row.getCell(c).numFmt = PCT1
    for (const c of [6, 7]) row.getCell(c).numFmt = NUM_FMT
  }
  finishTable(ws, { head: h1, lastRow: ws.rowCount, autoFilter: false, landscape: true })
  ws.addRow([])

  titleRow(ws, 'Chi theo NHÀ CUNG CẤP', 11)
  if (report.pareto_supplier) {
    noteRow(ws, `${report.pareto_supplier.count}/${report.pareto_supplier.of} nhà cung cấp đầu đã chiếm 80% tiền mua`)
  }
  const h2 = headerRow(ws, ['Nhà cung cấp', 'Tiền tệ', 'Số tiền', 'Tỉ lệ %', 'Luỹ kế %', 'Số mã', 'Số dòng'])
  for (const r of report.by_supplier_spend) {
    const row = ws.addRow([r.label, r.currency, r.amount, r.share, r.cumulative, r.material_count, r.line_count])
    row.getCell(3).numFmt = MONEY_FMT
    for (const c of [4, 5]) row.getCell(c).numFmt = PCT1
    for (const c of [6, 7]) row.getCell(c).numFmt = NUM_FMT
  }
  finishTable(ws, { head: h2, lastRow: ws.rowCount, autoFilter: false, landscape: true })
  ws.addRow([])

  titleRow(ws, 'RỦI RO MỘT NGUỒN CUNG', 11)
  noteRow(
    ws,
    `${report.single_source.length}/${report.bought_material_count} mã đã mua chỉ có ĐÚNG MỘT nhà cung cấp — NCC đó nghỉ, tăng giá hay giao trễ thì không có đường lui.`,
    'warn',
  )
  const h3 = headerRow(ws, ['Mã VT', 'Tên vật tư', 'Nhà cung cấp duy nhất', 'Tiền tệ', 'Đã mua'])
  for (const r of report.single_source.slice(0, 200)) {
    const row = ws.addRow([r.code, r.name, r.supplier_names[0] ?? '', r.currency, r.amount])
    row.getCell(5).numFmt = MONEY_FMT
  }
  applyWidths(ws, [30, 40, 30, 10, 18, 12, 12])
  finishTable(ws, { head: h3, autoFilter: false, landscape: true })
}

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
void dateCell
void DATE_FMT
