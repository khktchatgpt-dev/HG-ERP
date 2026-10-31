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
import type { ApLedgerBasis, apLedgerService } from './ap-ledger.service'
import { entryLabel, type LedgerEntry } from '@/lib/ap-ledger'

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

export function apLedgerExcelFilename(
  month: string,
  basis: ApLedgerBasis = 'invoice',
): string {
  const mm = `${month.slice(5, 7)}-${month.slice(0, 4)}`
  return basis === 'receipt'
    ? `So cong no NCC theo hang nhan ${mm}.xlsx`
    : `So cong no phai tra TK331 ${mm}.xlsx`
}

/** Tên sổ in trên đầu sheet — người cầm tờ giấy phải biết sổ tính theo đâu. */
const bookTitle = (b: Book) =>
  b.basis === 'receipt'
    ? 'SỔ CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN — THEO HÀNG ĐÃ NHẬN'
    : 'SỔ CÔNG NỢ PHẢI TRẢ NGƯỜI BÁN — TK 331'

export async function buildApLedgerExcel(book: Book): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `${bookTitle(book)} ${monthLabel(book.month)}`)
  sheetSummary(wb, book)
  sheetDetail(wb, book)
  if (book.basis === 'receipt') sheetItems(wb, book)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/* ── 3. Theo dòng hàng — đúng mẫu sổ Excel của Kế toán ─────────────────── */
/**
 * Sheet để Kế toán ĐẶT CẠNH sổ Excel đang dùng (file "công nợ chi tiết" mỗi NCC
 * một sheet, đọc 31/10/2026): cùng thứ tự cột Tên SP · ĐVT · Đơn giá · Đơn hàng
 * / LSX · Số phiếu · Ngày giao · SL giao · Thành tiền chưa VAT · VAT · Tổng cộng
 * · Số HĐ, và cùng dòng chốt "Tổng cộng T10/2026" từng NCC. Thêm cột "Phiếu nhập"
 * (mã ERP) để từ một dòng lệch tìm ngược được phiếu.
 *
 * Trả hàng / đảo phiếu là dòng ÂM trong cùng sheet; phiếu chi KHÔNG có mặt —
 * sổ của Kế toán cũng không theo dõi thanh toán ở đây.
 */
function sheetItems(wb: ExcelJS.Workbook, book: Book): void {
  const ws = wb.addWorksheet('Theo dòng hàng')
  const [y, m] = book.month.split('-')
  const closeLabel = `Tổng cộng T${m}/${y}`
  titleRow(ws, `CÔNG NỢ CHI TIẾT THEO DÒNG HÀNG — THÁNG ${Number(m)}/${y}`)
  noteRow(ws, 'Cùng thứ tự cột với sổ "công nợ chi tiết" của Kế toán. Tiền gồm VAT theo thuế suất trên đơn mua; trả hàng / đảo phiếu là dòng âm.') // prettier-ignore
  noteRow(ws, 'Số phiếu = số in trên phiếu giao của NCC. Ô ghi mã đơn HG hoặc để trống thì chưa khớp được với sổ Kế toán.', 'warn') // prettier-ignore
  ws.addRow([])

  const head = headerRow(ws, [
    'Tên SP',
    'ĐVT',
    'Đơn giá',
    'Đơn hàng / LSX',
    'Số phiếu',
    'Phiếu nhập',
    'Ngày giao hàng',
    'SL giao',
    'Thành tiền (chưa VAT)',
    'VAT',
    'Tổng cộng',
    'Số HĐ',
  ])

  for (const d of book.details) {
    const lines = d.lines.filter((l) => l.kind !== 'payment' && l.items?.length)
    if (lines.length === 0) continue
    groupRow(ws, `${d.supplier_name} · ${d.currency}`, 12)
    let net = 0
    let vat = 0
    let amount = 0
    for (const l of lines) {
      const sign = l.kind === 'invoice' ? 1 : -1
      const ref = [l.po_code, l.lsx_code].filter(Boolean).join(' · ')
      for (const it of l.items ?? []) {
        const row = ws.addRow([
          it.name,
          it.unit ?? '',
          it.price,
          ref,
          l.party_doc_no ?? '',
          l.kind === 'invoice'
            ? l.doc_no
            : `${l.doc_no} (${entryLabel(l).toLowerCase()})`,
          dateCell(l.date),
          sign * it.qty,
          sign * it.net,
          sign * it.vat,
          sign * it.amount,
          '',
        ])
        row.getCell(7).numFmt = DATE_FMT
        row.getCell(8).numFmt = NUM_FMT
        for (const c of [3, 9, 10, 11]) row.getCell(c).numFmt = MONEY_FMT
        net += sign * it.net
        vat += sign * it.vat
        amount += sign * it.amount
      }
    }
    const r2 = (n: number) => Math.round(n * 100) / 100
    const close = totalRow(ws, `${closeLabel} · ${d.supplier_name}`, { 9: r2(net), 10: r2(vat), 11: r2(amount) }, 1) // prettier-ignore
    for (const c of [9, 10, 11]) close.getCell(c).numFmt = MONEY_FMT
    ws.addRow([])
  }

  applyWidths(ws, [34, 8, 12, 26, 18, 22, 12, 12, 18, 14, 18, 10])
  finishTable(ws, { head, freezeCols: 1, autoFilter: false, landscape: true })
}

/* ── 1. Sổ tổng hợp ────────────────────────────────────────────────────── */
function sheetSummary(wb: ExcelJS.Workbook, book: Book): void {
  const ws = wb.addWorksheet('Sổ tổng hợp')
  titleRow(ws, bookTitle(book))
  noteRow(ws, `Kỳ ${dmy(book.from)} → ${dmy(book.to)} · Dư đầu kỳ + Phát sinh tăng − Trả hàng · đảo phiếu − Đã thanh toán = Dư cuối kỳ`) // prettier-ignore
  noteRow(
    ws,
    book.basis === 'receipt'
      ? 'Phát sinh TĂNG = phiếu nhập kho gắn đơn mua, GỒM VAT theo thuế suất trên đơn — chưa phải hoá đơn NCC. Đã thanh toán = phiếu chi.'
      : 'Phát sinh TĂNG = hoá đơn NCC đã vào sổ (gồm VAT), KHÔNG phải phiếu nhập kho. Phát sinh GIẢM = phiếu chi.',
  )
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
    'Trả hàng · đảo phiếu',
    'Đã thanh toán',
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
      r.returned,
      r.decrease,
      r.closing,
      r.entry_count,
      // null = thiếu tỷ giá → ô TRỐNG THẬT. Số 0 ở đây đọc ra là "không nợ gì".
      r.closing_base ?? null,
    ])
    for (const c of [3, 4, 5, 6, 7, 9]) row.getCell(c).numFmt = MONEY_FMT
    row.getCell(8).numFmt = NUM_FMT
  }
  const lastData = ws.rowCount
  applyWidths(ws, [34, 9, 18, 18, 18, 18, 18, 14, 20])
  finishTable(ws, { head, lastRow: lastData, freezeCols: 1, landscape: true })

  // Cộng theo TỪNG tiền tệ, mỗi loại một dòng — không có dòng trộn.
  ws.addRow([])
  for (const t of book.totals) {
    const r = totalRow(ws, `Cộng ${t.currency} (${t.supplier_count} NCC)`, {
      3: t.opening,
      4: t.increase,
      5: t.returned,
      6: t.decrease,
      7: t.closing,
      9: t.closing_base ?? null,
    })
    for (const c of [3, 4, 5, 6, 7, 9]) r.getCell(c).numFmt = MONEY_FMT
  }
  if (book.closing_base_total != null && book.totals.length > 1) {
    const r = totalRow(ws, 'TỔNG DƯ CUỐI QUY VND', { 9: book.closing_base_total })
    r.getCell(9).numFmt = MONEY_FMT
  }
}

/* ── 2. Sổ chi tiết ────────────────────────────────────────────────────── */
function sheetDetail(wb: ExcelJS.Workbook, book: Book): void {
  const ws = wb.addWorksheet('Sổ chi tiết')
  titleRow(ws, bookTitle(book).replace('SỔ CÔNG NỢ', 'SỔ CHI TIẾT CÔNG NỢ'))
  noteRow(ws, `Kỳ ${dmy(book.from)} → ${dmy(book.to)} · cột "Số dư luỹ kế" để đối chiếu từng dòng với bảng kê NCC gửi`) // prettier-ignore
  noteRow(ws, 'Không bật lọc tự động: lọc sẽ giấu mất dòng tiêu đề nhà cung cấp.', 'warn') // prettier-ignore
  ws.addRow([])

  const head = headerRow(ws, [
    'Ngày',
    'Số chứng từ',
    'Diễn giải',
    'Đơn mua',
    'Số HĐ / phiếu giao NCC',
    'Tiền tệ',
    'Tiền hàng',
    'VAT',
    'Phát sinh tăng',
    'Phát sinh giảm',
    'Số dư luỹ kế',
  ])

  for (const d of book.details) {
    groupRow(ws, `${d.supplier_name} · ${d.currency}`, 11)
    const open = ws.addRow(['', '', 'Số dư đầu kỳ', '', '', d.currency, null, null, null, null, d.opening]) // prettier-ignore
    open.getCell(3).font = { italic: true }
    open.getCell(11).numFmt = MONEY_FMT
    for (const l of d.lines) {
      const row = ws.addRow([
        dateCell(l.date),
        l.doc_no,
        entryLabel(l),
        l.po_code ?? '',
        l.party_doc_no ?? '',
        d.currency,
        l.net ?? null,
        l.vat ?? null,
        l.kind === 'invoice' ? l.amount : null,
        // Trả hàng và thanh toán cùng là phát sinh GIẢM; cột Diễn giải phân biệt.
        l.kind === 'invoice' ? null : l.amount,
        l.running,
      ])
      row.getCell(1).numFmt = DATE_FMT
      for (const c of [7, 8, 9, 10, 11]) row.getCell(c).numFmt = MONEY_FMT
    }
    const close = totalRow(ws, `Cộng ${d.supplier_name} · ${d.currency}`, {
      9: sum(d.lines, 'invoice'),
      10: sum(d.lines, 'return') + sum(d.lines, 'payment'),
      11: (d.lines.at(-1)?.running ?? d.opening),
    }, 3) // prettier-ignore
    for (const c of [9, 10, 11]) close.getCell(c).numFmt = MONEY_FMT
    ws.addRow([])
  }

  applyWidths(ws, [12, 18, 24, 15, 18, 9, 16, 14, 18, 18, 20])
  // `autoFilter: false` — xem docstring đầu file.
  finishTable(ws, { head, freezeCols: 0, autoFilter: false, landscape: true })
}

const sum = (lines: Book['details'][number]['lines'], kind: LedgerEntry['kind']) =>
  Math.round(
    lines.filter((l) => l.kind === kind).reduce((s, l) => s + l.amount, 0) * 100,
  ) / 100

const fmt = (n: number) => n.toLocaleString('vi-VN')
