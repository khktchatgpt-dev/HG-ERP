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
import {
  monthTotals,
  type MonthRow,
  type SheetDoc,
  type SheetMonth,
} from '@/lib/cong-no-thang'

/**
 * EXCEL CÔNG NỢ NCC THEO THÁNG — cùng hình với sổ Excel "công nợ chi tiết" của Kế
 * toán (đọc 31/10/2026) để đặt cạnh nhau mà dò: cột Tên SP · ĐVT · Đơn giá · Đơn
 * hàng / LSX · Số phiếu · Ngày giao · SL giao · Thành tiền · VAT · Tổng cộng, mỗi
 * tháng chốt dòng "Tổng cộng T10/2026". Thêm cột "Phiếu nhập" (mã ERP) để từ một
 * dòng lệch tìm ngược được phiếu. Dòng chưa có giá ghi chữ, không ghi 0.
 */

const mm = (month: string) => `${month.slice(5, 7)}/${month.slice(0, 4)}`
const fileMonth = (month: string) => `${month.slice(5, 7)}-${month.slice(0, 4)}`

const ITEM_HEAD = [
  'Tên SP',
  'ĐVT',
  'Đơn giá',
  'Đơn hàng / LSX',
  'Số phiếu NCC',
  'Phiếu nhập',
  'Ngày giao',
  'SL giao',
  'Thành tiền (chưa VAT)',
  'VAT',
  'Tổng cộng',
]
const ITEM_WIDTHS = [36, 8, 12, 28, 16, 16, 12, 12, 18, 14, 18]

function docNote(d: SheetDoc): string {
  if (d.kind === 'reversal')
    return d.reversal_of
      ? `${d.doc_code} (đảo ${d.reversal_of.code})`
      : `${d.doc_code} (đảo phiếu)`
  if (d.kind === 'return') return `${d.doc_code} (trả hàng NCC)`
  if (d.kind === 'unreversal') return `${d.doc_code} (đảo phiếu trả)`
  return d.doc_code
}

/** Các dòng hàng của một phiếu, đúng thứ tự cột ITEM_HEAD. */
function addDocLines(ws: ExcelJS.Worksheet, d: SheetDoc): void {
  const ref = [d.po_code, d.lsx_code].filter(Boolean).join(' · ')
  for (const l of d.lines) {
    const row = ws.addRow([
      l.name,
      l.unit ?? '',
      l.price ?? 'chưa có giá',
      ref,
      d.party_doc_no ?? '',
      docNote(d),
      dateCell(d.date),
      l.qty,
      l.net,
      l.vat,
      l.amount,
    ])
    row.getCell(7).numFmt = DATE_FMT
    row.getCell(8).numFmt = NUM_FMT
    for (const c of [3, 9, 10, 11]) row.getCell(c).numFmt = MONEY_FMT
  }
}

function closeRow(
  ws: ExcelJS.Worksheet,
  label: string,
  t: { net: number; vat: number; amount: number; unpriced: number },
) {
  const r = totalRow(ws, t.unpriced ? `${label} (thiếu ${t.unpriced} dòng chưa giá)` : label, { 9: t.net, 10: t.vat, 11: t.amount }, 1) // prettier-ignore
  for (const c of [9, 10, 11]) r.getCell(c).numFmt = MONEY_FMT
}

export function congNoThangFilename(month: string): string {
  return `Cong no NCC thang ${fileMonth(month)}.xlsx`
}

export function congNoNccFilename(
  supplierName: string,
  from: string,
  to: string,
): string {
  const ascii = supplierName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D') // prettier-ignore
  const range = from === to ? fileMonth(from) : `${fileMonth(from)} den ${fileMonth(to)}`
  return `Cong no ${ascii
    .replace(/[^\w\s-]/g, '')
    .trim()
    .slice(0, 60)} ${range}.xlsx`
}

/** Một tháng: sheet danh sách NCC (3 số) + sheet mọi dòng hàng, nhóm theo NCC. */
export async function buildCongNoThangExcel(
  month: string,
  rows: MonthRow[],
  docs: SheetDoc[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `Công nợ NCC tháng ${mm(month)}`)

  const ws = wb.addWorksheet(`Tháng ${fileMonth(month)}`)
  titleRow(ws, `CÔNG NỢ NHÀ CUNG CẤP — THÁNG ${mm(month)}`)
  noteRow(
    ws,
    'Tổng cộng = hàng giao trong tháng trừ trả hàng / đảo phiếu trong tháng, gồm VAT theo đơn mua.',
  )
  ws.addRow([])
  const head = headerRow(ws, ['STT', 'Nhà cung cấp', 'Số phiếu', 'Thành tiền (chưa VAT)', 'VAT', `Tổng cộng T${mm(month)}`]) // prettier-ignore
  const totals = monthTotals(rows)
  for (const t of totals) {
    if (totals.length > 1)
      groupRow(ws, t.currency === 'VND' ? 'VND' : `Ngoại tệ ${t.currency}`, 6)
    rows
      .filter((r) => r.currency === t.currency)
      .forEach((r, i) => {
        const row = ws.addRow([i + 1, r.supplier_name, r.docs, r.net, r.vat, r.amount])
        row.getCell(3).numFmt = NUM_FMT
        for (const c of [4, 5, 6]) row.getCell(c).numFmt = MONEY_FMT
      })
    const tr = totalRow(ws, `Tổng cộng T${mm(month)} · ${t.suppliers} NCC${t.currency === 'VND' ? '' : ` (${t.currency})`}`, { 3: t.docs, 4: t.net, 5: t.vat, 6: t.amount }, 2) // prettier-ignore
    for (const c of [4, 5, 6]) tr.getCell(c).numFmt = MONEY_FMT
  }
  applyWidths(ws, [6, 48, 10, 20, 16, 20])
  finishTable(ws, { head, freezeCols: 2, autoFilter: false, landscape: false })

  const wi = wb.addWorksheet('Theo dòng hàng')
  titleRow(wi, `CÔNG NỢ CHI TIẾT THEO DÒNG HÀNG — THÁNG ${mm(month)}`)
  noteRow(
    wi,
    'Số phiếu NCC = số in trên phiếu giao của NCC. Trả hàng / đảo phiếu là dòng âm.',
  )
  wi.addRow([])
  const hi = headerRow(wi, ITEM_HEAD)
  for (const r of rows) {
    const mine = docs.filter(
      (d) => d.supplier_id === r.supplier_id && d.currency === r.currency,
    )
    groupRow(
      wi,
      `${r.supplier_name}${r.currency === 'VND' ? '' : ` · ${r.currency}`}`,
      ITEM_HEAD.length,
    )
    for (const d of mine) addDocLines(wi, d)
    closeRow(wi, `Tổng cộng T${mm(month)} · ${r.supplier_name}`, r)
    wi.addRow([])
  }
  applyWidths(wi, ITEM_WIDTHS)
  finishTable(wi, { head: hi, freezeCols: 1, autoFilter: false, landscape: true })
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Một NCC: một sheet như sổ Excel của Kế toán, các tháng mới nhất trước. */
export async function buildCongNoNccExcel(
  supplierName: string,
  sheet: SheetMonth[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `Công nợ ${supplierName}`)
  const ws = wb.addWorksheet('Sổ NCC')
  titleRow(ws, `CÔNG NỢ ${supplierName.toUpperCase()}`)
  noteRow(
    ws,
    'Tiền gồm VAT theo đơn mua. Trả hàng / đảo phiếu là dòng âm. Tháng mới nhất ở trên.',
  )
  ws.addRow([])
  const head = headerRow(ws, ITEM_HEAD)
  for (const m of sheet) {
    groupRow(
      ws,
      `THÁNG ${mm(m.month)}${m.currency === 'VND' ? '' : ` · ${m.currency}`}`,
      ITEM_HEAD.length,
    )
    for (const d of m.docs) addDocLines(ws, d)
    closeRow(ws, `Tổng cộng T${mm(m.month)} · ${m.docs.length} phiếu`, m)
    ws.addRow([])
  }
  applyWidths(ws, ITEM_WIDTHS)
  finishTable(ws, { head, freezeCols: 1, autoFilter: false, landscape: true })
  return Buffer.from(await wb.xlsx.writeBuffer())
}
