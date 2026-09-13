import ExcelJS from 'exceljs'
import {
  DATE_FMT,
  MONEY_FMT,
  NUM_FMT,
  applyWidths,
  dateCell,
  finishTable,
  groupRow,
  headerRow,
  noteRow,
  stampWorkbook,
  titleRow,
  totalRow,
} from '@/modules/dept/supply/excel-kit'
import type { apLedgerService } from './ap-ledger.service'

/**
 * XUẤT EXCEL SỔ CÔNG NỢ PHẢI TRẢ (TK 331).
 *
 * Hai sheet, đúng hai thứ kế toán in ra:
 *   Sổ tổng hợp — mỗi NCC × tiền tệ một dòng: dư đầu → phát sinh → dư cuối.
 *   Sổ chi tiết — từng chứng từ, có cột SỐ DƯ LUỸ KẾ để dò với bảng kê NCC gửi.
 *
 * ⭐ CỘT SỐ DƯ LUỸ KẾ là lý do tồn tại của sheet chi tiết. Đối chiếu công nợ là
 * hai bên đi từng dòng tìm chỗ số dư bắt đầu lệch; bảng không có cột đó thì mỗi
 * lần dò phải cộng tay lại từ đầu sổ.
 *
 * ⭐ KHÔNG CÓ DÒNG "TỔNG CỘNG TẤT CẢ" trộn tiền tệ. Trong Excel người ta hay bôi
 * đen cả cột rồi xem SUM ở thanh trạng thái, nên để VND và USD chung một cột là
 * đặt bẫy. Tổng cộng theo TỪNG tiền tệ, mỗi loại một dòng.
 *
 * Sheet chi tiết dùng `groupRow` nên TẮT lọc tự động: lọc sẽ giấu mất dòng tiêu
 * đề NCC và người đọc mất luôn ngữ cảnh dòng đang xem thuộc về ai.
 */

type Book = Awaited<ReturnType<typeof apLedgerService.fullBook>>

const dmy = (iso: string) => iso.split('-').reverse().join('/')
const monthLabel = (m: string) => {
  const [y, mm] = m.split('-')
  return `tháng ${Number(mm)}/${y}`
}

export function apLedgerExcelFilename(month: string): string {
  return `So cong no phai tra TK331 ${month.slice(5, 7)}-${month.slice(0, 4)}.xlsx`
}

export async function buildApLedgerExcel(book: Book): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `Sổ công nợ phải trả TK 331 ${monthLabel(book.month)}`)
  sheetSummary(wb, book)
  sheetDetail(wb, book)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/* ── 1. Sổ tổng hợp ────────────────────────────────────────────────────── */
function sheetSummary(wb: ExcelJS.Workbook, book: Book): void {
  const ws = wb.addWorksheet('Sổ tổng hợp')
  titleRow(ws, 'SỔ CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN — TK 331')
  noteRow(ws, `Kỳ ${dmy(book.from)} → ${dmy(book.to)} · Dư đầu kỳ + Phát sinh tăng − Phát sinh giảm = Dư cuối kỳ`) // prettier-ignore
  noteRow(ws, 'Phát sinh TĂNG = hoá đơn NCC đã vào sổ (gồm VAT), KHÔNG phải phiếu nhập kho. Phát sinh GIẢM = phiếu chi.') // prettier-ignore
  if (book.off_book.length > 0) {
    noteRow(ws, `NGOÀI SỔ: ${book.off_book.map((o) => `${fmt(o.amount)} ${o.currency}`).join(' · ')} hàng đã về nhưng NCC chưa xuất hoá đơn (${book.off_book_suppliers} NCC) — CHƯA nằm trong số dư dưới đây.`, 'warn') // prettier-ignore
  }
  if (book.missing_fx.length > 0) {
    noteRow(ws, `Thiếu tỷ giá ngày ${dmy(book.to)} cho ${book.missing_fx.join(', ')} — cột Quy VND để TRỐNG, không phải 0.`, 'warn') // prettier-ignore
  }
  for (const g of book.gaps) noteRow(ws, `${g.label}: ${g.detail}`, 'warn')
  ws.addRow([])

  const head = headerRow(ws, [
    'Nhà cung cấp',
    'Tiền tệ',
    'Dư đầu kỳ',
    'Phát sinh tăng',
    'Phát sinh giảm',
    'Dư cuối kỳ',
    'Số CT trong kỳ',
    'Dư cuối quy VND',
  ])
  for (const r of book.rows) {
    const row = ws.addRow([
      r.supplier_name,
      r.currency,
      r.opening,
      r.increase,
      r.decrease,
      r.closing,
      r.entry_count,
      // null = thiếu tỷ giá → ô TRỐNG THẬT. Số 0 ở đây đọc ra là "không nợ gì".
      r.closing_base ?? null,
    ])
    for (const c of [3, 4, 5, 6, 8]) row.getCell(c).numFmt = MONEY_FMT
    row.getCell(7).numFmt = NUM_FMT
  }
  const lastData = ws.rowCount
  applyWidths(ws, [34, 9, 18, 18, 18, 18, 14, 20])
  finishTable(ws, { head, lastRow: lastData, freezeCols: 1, landscape: true })

  // Cộng theo TỪNG tiền tệ, mỗi loại một dòng — không có dòng trộn.
  ws.addRow([])
  for (const t of book.totals) {
    const r = totalRow(ws, `Cộng ${t.currency} (${t.supplier_count} NCC)`, {
      3: t.opening,
      4: t.increase,
      5: t.decrease,
      6: t.closing,
      8: t.closing_base ?? null,
    })
    for (const c of [3, 4, 5, 6, 8]) r.getCell(c).numFmt = MONEY_FMT
  }
  if (book.closing_base_total != null && book.totals.length > 1) {
    const r = totalRow(ws, 'TỔNG DƯ CUỐI QUY VND', { 8: book.closing_base_total })
    r.getCell(8).numFmt = MONEY_FMT
  }
}

/* ── 2. Sổ chi tiết ────────────────────────────────────────────────────── */
function sheetDetail(wb: ExcelJS.Workbook, book: Book): void {
  const ws = wb.addWorksheet('Sổ chi tiết')
  titleRow(ws, 'SỔ CHI TIẾT CÔNG NỢ PHẢI TRẢ — TK 331')
  noteRow(ws, `Kỳ ${dmy(book.from)} → ${dmy(book.to)} · cột "Số dư luỹ kế" để đối chiếu từng dòng với bảng kê NCC gửi`) // prettier-ignore
  noteRow(ws, 'Không bật lọc tự động: lọc sẽ giấu mất dòng tiêu đề nhà cung cấp.', 'warn') // prettier-ignore
  ws.addRow([])

  const head = headerRow(ws, [
    'Ngày',
    'Số chứng từ',
    'Diễn giải',
    'Tiền tệ',
    'Phát sinh tăng',
    'Phát sinh giảm',
    'Số dư luỹ kế',
  ])

  for (const d of book.details) {
    groupRow(ws, `${d.supplier_name} · ${d.currency}`, 7)
    const open = ws.addRow(['', '', 'Số dư đầu kỳ', d.currency, null, null, d.opening])
    open.getCell(3).font = { italic: true }
    open.getCell(7).numFmt = MONEY_FMT
    for (const l of d.lines) {
      const row = ws.addRow([
        dateCell(l.date),
        l.doc_no,
        l.kind === 'invoice' ? 'Hoá đơn NCC' : 'Thanh toán',
        d.currency,
        l.kind === 'invoice' ? l.amount : null,
        l.kind === 'payment' ? l.amount : null,
        l.running,
      ])
      row.getCell(1).numFmt = DATE_FMT
      for (const c of [5, 6, 7]) row.getCell(c).numFmt = MONEY_FMT
    }
    const close = totalRow(ws, `Cộng ${d.supplier_name} · ${d.currency}`, {
      5: sum(d.lines, 'invoice'),
      6: sum(d.lines, 'payment'),
      7: (d.lines.at(-1)?.running ?? d.opening),
    }, 3) // prettier-ignore
    for (const c of [5, 6, 7]) close.getCell(c).numFmt = MONEY_FMT
    ws.addRow([])
  }

  applyWidths(ws, [12, 20, 34, 9, 18, 18, 20])
  // `autoFilter: false` — xem docstring đầu file.
  finishTable(ws, { head, freezeCols: 0, autoFilter: false, landscape: true })
}

const sum = (lines: Book['details'][number]['lines'], kind: 'invoice' | 'payment') =>
  Math.round(
    lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.amount, 0) * 100,
  ) / 100

const fmt = (n: number) => n.toLocaleString('vi-VN')
