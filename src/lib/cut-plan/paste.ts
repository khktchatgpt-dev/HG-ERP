import {
  CUT_LINE_COLUMNS,
  CUT_LINE_LABEL,
  type CutLine,
  type CutLineColumn,
} from './types'

/**
 * DÁN TỪ EXCEL vào lưới quy cắt.
 *
 * Hai đường:
 *  1. `parseCutPaste(text)` — dán CẢ BẢNG (có hoặc không có dòng tiêu đề): nhận
 *     cột theo tiêu đề; không có tiêu đề thì đoán theo nội dung (cột số đầu tiên
 *     là chiều dài, cột số thứ hai là số lượng; cột chữ đầu là tên chi tiết).
 *  2. `pasteMatrix(text)` + `applyPasteAt(...)` — dán một VÙNG Ô ngay tại ô
 *     đang đứng, các cột chạy sang phải như Excel (đứng ở "Dài cắt" dán hai cột
 *     số thì vào Dài + SL). Đây là điều phần mềm cũ không làm được.
 */

const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().trim()

/**
 * Đọc số kiểu Việt: "1.390" là một nghìn ba trăm chín mươi (dấu chấm nhóm
 * nghìn), "1390,5" là số lẻ. Dấu chấm HOẶC phẩy đứng trước đúng 3 chữ số cuối là
 * nhóm nghìn — không có chi tiết nào dài 1,39 mm. Ngoại lệ "0.525" (phần nguyên
 * chỉ một số 0) là thập phân — cùng luật với lib/bom-paste.
 */
export function parseNum(v: string | undefined): number | null {
  if (v == null) return null
  const s = v
    .replace(/\s/g, '')
    .replace(/(?<!^-?0)[.,](?=\d{3}\b)/g, '')
    .replace(',', '.')
  const cleaned = s.replace(/[^\d.-]/g, '')
  if (!cleaned || !/\d/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/**
 * Ô số của lưới từ một chuỗi: chiều dài giữ số lẻ (1390,5), SỐ LƯỢNG là số
 * nguyên ≥ 1 (không ai cắt 2,5 cái — làm tròn, tránh đầu trang đếm 42,5 chi
 * tiết còn sơ đồ xếp 43). Không đọc được hoặc ≤ 0 → ô trống. Dùng chung cho cả
 * hai đường dán và ô gõ tay để một chuỗi chỉ có một cách hiểu.
 */
export function parseCell(col: 'length_mm' | 'qty', v: string): number | '' {
  const n = parseNum(v)
  if (n == null || !(n > 0)) return ''
  if (col === 'qty') return Math.max(1, Math.round(n))
  return n
}

const looksNumeric = (v: string) =>
  /^\s*-?[\d.,\s]+\s*(mm|cái|cai|pcs|pc)?\s*$/i.test(v) && /\d/.test(v)

/** Tách văn bản dán thành ma trận ô: tab (Excel) → chấm phẩy → 2+ khoảng trắng. */
export function pasteMatrix(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  const hasTab = lines.some((l) => l.includes('\t'))
  const hasSemi = !hasTab && lines.some((l) => l.includes(';'))
  return lines.map((l) => {
    const cells = hasTab
      ? l.split('\t')
      : hasSemi
        ? l.split(';')
        : l.trim().split(/\s{2,}|\t/)
    return cells.map((c) => c.replace(/\s+/g, ' ').trim())
  })
}

type Field = CutLineColumn | 'skip'

/** Tiêu đề → cột. Luật hẹp đứng trước luật rộng. */
const HEADER_RULES: [RegExp, Field][] = [
  [/^(stt|tt|so tt|no\.?|#)$/, 'skip'],
  [/ten chi tiet|chi tiet|ten hang|^ten$|part|name|detail/, 'part_name'],
  [/tong (chieu )?dai|tong dai/, 'skip'],
  [/chieu dai|dai cat|^dai|length|^l$|\(mm\)/, 'length_mm'],
  [/so luong|^sl$|^sl |qty|quantity|so cai/, 'qty'],
  [/ghi chu|note|remark/, 'note'],
]

function headerField(cell: string): Field | null {
  const h = noAccent(cell)
  if (!h) return null
  for (const [re, f] of HEADER_RULES) if (re.test(h)) return f
  return null
}

export type CutPasteResult = {
  rows: Omit<CutLine, 'key'>[]
  skipped: { line: number; text: string; reason: string }[]
  mapped: { index: number; field: Field; label: string }[]
  source: 'header' | 'guess'
}

function guessFields(rows: string[][]): Field[] {
  const width = Math.max(0, ...rows.map((r) => r.length))
  const fields: Field[] = new Array(width).fill('skip')
  const numeric: number[] = []
  const texty: number[] = []
  for (let c = 0; c < width; c++) {
    const vals = rows.map((r) => r[c] ?? '').filter((v) => v !== '')
    if (vals.length === 0) continue
    const nums = vals.filter(looksNumeric).length
    if (nums / vals.length >= 0.8) numeric.push(c)
    else texty.push(c)
  }
  // Cột số: dài trước, SL sau. Cột STT (1,2,3… tăng dần từ 1) bỏ.
  const isSeq = (c: number) =>
    rows.every((r, i) => {
      const v = parseNum(r[c])
      return v == null || v === i + 1
    })
  const nums = numeric.filter((c) => !isSeq(c) || numeric.length <= 2)
  if (nums.length >= 1) fields[nums[0]] = 'length_mm'
  if (nums.length >= 2) fields[nums[1]] = 'qty'
  // Cột chữ đầu là tên chi tiết, cột chữ sau là ghi chú.
  if (texty[0] != null) fields[texty[0]] = 'part_name'
  if (texty[1] != null) fields[texty[1]] = 'note'
  return fields
}

export function parseCutPaste(text: string): CutPasteResult {
  const matrix = pasteMatrix(text).filter((r) => r.some((c) => c !== ''))
  const empty: CutPasteResult = { rows: [], skipped: [], mapped: [], source: 'guess' }
  if (matrix.length === 0) return empty

  const first = matrix[0]
  const headerHits = first.map(headerField)
  const isHeader =
    headerHits.filter((f) => f && f !== 'skip').length >= 2 ||
    (headerHits.some((f) => f === 'length_mm') && !first.some(looksNumeric))

  let fields: Field[]
  let body: string[][]
  let source: CutPasteResult['source']
  let offset = 0
  if (isHeader) {
    fields = headerHits.map((f) => f ?? 'skip')
    body = matrix.slice(1)
    source = 'header'
    offset = 1
  } else {
    fields = guessFields(matrix)
    body = matrix
    source = 'guess'
  }

  const mapped = fields
    .map((field, index) => ({
      index,
      field,
      label: field === 'skip' ? '—' : CUT_LINE_LABEL[field],
    }))
    .filter((m) => m.field !== 'skip')

  const rows: CutPasteResult['rows'] = []
  const skipped: CutPasteResult['skipped'] = []
  body.forEach((r, i) => {
    const lineNo = i + 1 + offset
    const row: Omit<CutLine, 'key'> = { part_name: '', length_mm: '', qty: '', note: '' }
    fields.forEach((f, c) => {
      const v = r[c] ?? ''
      if (f === 'skip' || v === '') return
      if (f === 'length_mm' || f === 'qty') {
        const n = parseCell(f, v)
        if (n !== '') row[f] = n
      } else row[f] = v
    })
    const text = r.join(' | ')
    const hasAny = row.part_name || row.length_mm !== '' || row.qty !== ''
    if (!hasAny) return
    if (row.length_mm === '' && /\b(tong|total|cong)\b/.test(noAccent(text))) {
      skipped.push({ line: lineNo, text, reason: 'Dòng tổng' })
      return
    }
    if (row.length_mm === '') {
      skipped.push({ line: lineNo, text, reason: 'Không đọc được chiều dài' })
      return
    }
    if (row.qty === '') row.qty = 1
    rows.push(row)
  })
  return { rows, skipped, mapped, source }
}

/**
 * Dán một vùng ô vào lưới tại (dòng, cột) đang đứng — cột chạy sang phải theo
 * thứ tự cột của lưới, dòng chạy xuống, thiếu dòng thì thêm. Không đụng ô ngoài
 * vùng dán. Trả về lưới mới + số dòng đã thêm.
 */
export function applyPasteAt(
  lines: CutLine[],
  startRow: number,
  startCol: CutLineColumn,
  matrix: string[][],
  nextKey: () => number,
): { lines: CutLine[]; added: number; cells: number } {
  const out = lines.map((l) => ({ ...l }))
  const colStart = CUT_LINE_COLUMNS.indexOf(startCol)
  let added = 0
  let cells = 0
  matrix.forEach((r, ri) => {
    const rowIdx = startRow + ri
    while (out.length <= rowIdx) {
      out.push({ key: nextKey(), part_name: '', length_mm: '', qty: '', note: '' })
      added++
    }
    r.forEach((v, ci) => {
      const col = CUT_LINE_COLUMNS[colStart + ci]
      if (!col) return
      cells++
      if (col === 'length_mm' || col === 'qty') {
        out[rowIdx][col] = parseCell(col, v)
      } else out[rowIdx][col] = v
    })
  })
  return { lines: out, added, cells }
}
