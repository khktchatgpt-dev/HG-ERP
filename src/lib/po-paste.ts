/**
 * DÁN TỪ EXCEL vào form đơn đặt hàng — phần PARSE thuần, testable.
 *
 * Vì sao có: BOM chưa hoàn thiện nên nhân viên Cung ứng vẫn TÍNH SL TRONG SỔ
 * EXCEL rồi gõ lại từng dòng vào form — đơn phụ kiện 20-30 dòng là 20-30 lượt
 * tìm-chọn-gõ. Cho dán thẳng vùng bảng (tên/mã · SL · giá) thì việc gõ lại chỉ
 * còn ở những dòng máy không khớp được mã.
 *
 * NHẬN CỘT THEO TIÊU ĐỀ trước, không có tiêu đề mới đoán theo nội dung — cùng
 * triết lý `bom-paste.ts` (biểu mẫu Excel của xưởng đổi cột theo thời kỳ, ánh
 * xạ cứng theo vị trí là sai hàng loạt khi ai đó chèn một cột).
 */

export type PastedPoLine = {
  /** Tên hàng như trong sổ — dùng để khớp mã ở server. */
  name: string
  /** Mã VT nếu sổ có cột mã — khớp thẳng, khỏi so mờ. */
  code: string | null
  qty: number | null
  price: number | null
  note: string | null
}

export type PoPasteResult = {
  lines: PastedPoLine[]
  /** Dòng bị bỏ (tổng/cộng, trống tên) — nói ra, không nuốt im lặng. */
  skipped: number
  /** Có nhận ra hàng tiêu đề không — UI nói rõ đang đoán cột hay đọc tiêu đề. */
  headerDetected: boolean
}

/** Hạ thường + bỏ dấu để so tiêu đề ("Số Lượng" ≡ "so luong"). */
function nod(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim()
}

/**
 * Đọc số kiểu sổ Việt lẫn Excel Anh: "1.234,5" · "1,234.5" · "1 234" · "1234".
 * Không ra số thì null — KHÔNG đoán.
 */
export function parsePasteNumber(raw: string): number | null {
  const s = raw.replace(/\s| /g, '').trim()
  if (!s || /[^\d.,-]/.test(s)) return null
  let normalized: string
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    normalized = s.replace(/\./g, '').replace(',', '.') // vi: 1.234,5
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    normalized = s.replace(/,/g, '') // en: 1,234.5
  } else {
    normalized = s.replace(',', '.') // "3,5" → 3.5 · "1234" giữ nguyên
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

type Cols = {
  name: number
  code: number | null
  qty: number | null
  price: number | null
  note: number | null
}

/** Từ khoá tiêu đề → cột. Thành tiền/ĐVT/tồn… cố tình BỎ — app tự tính/tự có. */
const HEADERS: [keyof Cols, RegExp][] = [
  ['code', /^(ma( vt| vat tu| sp| hang)?|code)$/],
  ['name', /^(ten( hang( hoa)?| vat tu| sp)?|vat tu|hang hoa|chi tiet|dien giai)$/],
  ['qty', /^(sl|so luong|s\.luong|qty|sl dat( hang)?|so luong dat)$/],
  ['price', /^(don gia|gia|d\.gia|price|dg)( \(?vnd\)?| \(?usd\)?)?$/],
  ['note', /^(ghi chu|note|dien giai them)$/],
]

function detectHeader(cells: string[]): Cols | null {
  const cols: Partial<Cols> = {}
  let hits = 0
  cells.forEach((c, i) => {
    const k = nod(c)
    for (const [field, re] of HEADERS) {
      if (re.test(k) && cols[field] == null) {
        cols[field] = i
        hits++
        break
      }
    }
  })
  // Phải nhận được TÊN + ít nhất một cột nữa mới coi là tiêu đề — một chữ "SL"
  // lạc trong dòng dữ liệu không được phép chiếm quyền ánh xạ cả bảng.
  if (cols.name == null || hits < 2) return null
  return {
    name: cols.name,
    code: cols.code ?? null,
    qty: cols.qty ?? null,
    price: cols.price ?? null,
    note: cols.note ?? null,
  }
}

/** Cột trông như MÃ VT: ngắn, có chữ-số, dạng "NK-0012" / "PTBDDW-02N". */
const CODE_LIKE = /^[a-zA-Z]{1,8}[-_ ]?\d[\w-]*$/

/**
 * Không tiêu đề → đoán theo nội dung từng cột trên các dòng dữ liệu:
 *   tên  = cột chữ có độ dài trung bình lớn nhất
 *   mã   = cột chữ NGẮN mà đa số khớp dạng mã (trước cột tên)
 *   SL   = cột số đầu tiên sau cột tên; giá = cột số kế tiếp (giá thường to
 *          hơn SL nhưng "thường" không phải "luôn" — thứ tự cột đáng tin hơn)
 *   ghi chú = cột chữ còn lại sau cột tên
 */
function guessColumns(rows: string[][]): Cols | null {
  const width = Math.max(...rows.map((r) => r.length))
  if (width === 0) return null
  type Stat = { textLen: number; textN: number; numN: number; codeN: number; n: number }
  const stats: Stat[] = Array.from({ length: width }, () => ({
    textLen: 0,
    textN: 0,
    numN: 0,
    codeN: 0,
    n: 0,
  }))
  for (const r of rows) {
    r.forEach((cRaw, i) => {
      const c = cRaw.trim()
      if (!c) return
      const st = stats[i]
      st.n++
      if (parsePasteNumber(c) != null) st.numN++
      else {
        st.textN++
        st.textLen += c.length
        if (CODE_LIKE.test(c)) st.codeN++
      }
    })
  }
  const textCols = stats
    .map((s, i) => ({ i, s }))
    .filter(({ s }) => s.n > 0 && s.textN >= s.numN)
  if (textCols.length === 0) return null
  const name = textCols.reduce((a, b) =>
    b.s.textLen / Math.max(1, b.s.textN) > a.s.textLen / Math.max(1, a.s.textN) ? b : a,
  ).i
  const code =
    textCols.find(({ i, s }) => i !== name && s.codeN > s.textN / 2 && i < name)?.i ??
    null
  const numCols = stats
    .map((s, i) => ({ i, s }))
    .filter(({ i, s }) => i !== name && i !== code && s.numN > s.textN)
    .map(({ i }) => i)
    .filter((i) => i > name)
  const note = textCols.find(({ i }) => i !== name && i !== code && i > name)?.i ?? null
  return {
    name,
    code,
    qty: numCols[0] ?? null,
    price: numCols[1] ?? null,
    note,
  }
}

/** Dòng tổng/cộng — bỏ, không phải hàng. */
const TOTAL_ROW = /^(tong( cong)?|cong|total|sum)\b/

export function parsePoPaste(text: string, maxLines = 100): PoPasteResult {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.split('\t'))
    .filter((r) => r.some((c) => c.trim() !== ''))
  if (rows.length === 0) return { lines: [], skipped: 0, headerDetected: false }

  const headerCols = detectHeader(rows[0])
  const dataRows = headerCols ? rows.slice(1) : rows
  const cols = headerCols ?? guessColumns(dataRows)
  if (!cols) return { lines: [], skipped: rows.length, headerDetected: false }

  const lines: PastedPoLine[] = []
  let skipped = 0
  for (const r of dataRows) {
    if (lines.length >= maxLines) {
      skipped++
      continue
    }
    const cell = (i: number | null) => (i == null ? '' : (r[i] ?? '').trim())
    const name = cell(cols.name)
    // Bỏ dòng trống tên / dòng tổng — đếm vào skipped để UI nói ra.
    if (!name || TOTAL_ROW.test(nod(name))) {
      skipped++
      continue
    }
    lines.push({
      name,
      code: cell(cols.code) || null,
      qty: cols.qty != null ? parsePasteNumber(cell(cols.qty)) : null,
      price: cols.price != null ? parsePasteNumber(cell(cols.price)) : null,
      note: cell(cols.note) || null,
    })
  }
  return { lines, skipped, headerDetected: headerCols != null }
}
