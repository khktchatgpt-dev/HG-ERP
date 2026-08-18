/**
 * Dựng LƯỚI Ô của file BOM thành văn bản để đưa cho mô hình đọc.
 *
 * Vì sao không gửi ảnh chụp sheet: file .xlsx đã có sẵn cấu trúc ô: gửi text
 * vừa rẻ hơn nhiều lần, vừa chính xác hơn OCR, và quan trọng nhất là mô hình
 * TRẢ LẠI ĐƯỢC ĐỊA CHỈ Ô nguồn cho từng dòng nó trích — người kiểm bấm vào là
 * biết dòng đó lấy từ đâu, không phải tin suông. Ảnh/PDF mới đi đường vision.
 *
 * Định dạng phát ra, mỗi dòng một dòng sheet:
 *
 *     === Sheet "BOM_MER01" (cột A..L) ===
 *     4 | Stt | Parts/ Bộ phận | Tên chi tiết | Loại | …
 *     5 | 1 |  | Chân trước | Hộp | …
 *
 * Số đầu dòng là SỐ DÒNG THẬT trong Excel (1-based) — dòng trống bị lược nên
 * số không liên tục, và đó là chủ ý: giữ số thật thì `source_ref` mô hình trả
 * về ("BOM_MER01!C5") mới trỏ đúng ô khi người dùng mở file gốc ra soi. Vị trí
 * của ô trong dòng cho ra chữ cái cột.
 *
 * KHÔNG cắt âm thầm: quá ngưỡng thì ghi rõ đã bỏ bao nhiêu ở `truncated`, chỗ
 * gọi có trách nhiệm bày ra cho người dùng.
 */

/** Trần an toàn — BOM thật lớn nhất trong kho file là ~250 dòng / sheet. */
export const GRID_MAX_ROWS_PER_SHEET = 600
export const GRID_MAX_COLS = 40
/** ~200k ký tự ≈ 60k token, còn xa trần ngữ cảnh nhưng đủ chặn file rác. */
export const GRID_MAX_CHARS = 200_000

export type SheetGrid = {
  name: string
  /** Lưới ô thô, `rows[i][j]` = ô dòng i+1 cột j+1. Ô trống là null/undefined. */
  rows: unknown[][]
}

export type GridText = {
  text: string
  /** Sheet nào đã đưa vào, kèm số dòng thực sự phát ra. */
  sheets: { name: string; emitted: number }[]
  /** Đã bỏ những gì — rỗng nghĩa là đưa đủ. */
  truncated: string[]
}

/** Chỉ số cột 0-based → chữ cái cột Excel (0 → A, 26 → AA). */
export function colLetter(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/**
 * Một ô → chuỗi hiển thị. Giữ nguyên chữ số như Excel bày ra; ngày về ISO để
 * mô hình khỏi đoán d/m/y. Dấu `|` trong nội dung bị đổi thành `/` vì `|` là ký
 * tự phân cách của định dạng này.
 */
export function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
    .replace(/[\r\n]+/g, ' ')
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

const isBlankRow = (cells: string[]) => cells.every((c) => c === '')

/**
 * Lưới các sheet → một khối văn bản duy nhất.
 *
 * Sheet rỗng bị bỏ hẳn (file BOM hay kèm sheet "Sheet2" trắng). Ô trống ở đuôi
 * dòng cũng cắt, nhưng ô trống Ở GIỮA thì giữ — bỏ đi là lệch cột, đúng cái bẫy
 * mà `bom-paste.ts` đã phải xử lý một lần rồi.
 */
export function buildGridText(sheets: SheetGrid[]): GridText {
  const parts: string[] = []
  const used: { name: string; emitted: number }[] = []
  const truncated: string[] = []
  let chars = 0
  let stopped = false

  for (const sheet of sheets) {
    if (stopped) {
      truncated.push(`Sheet "${sheet.name}" chưa đọc (đã chạm trần dung lượng)`)
      continue
    }

    const lines: string[] = []
    let emitted = 0
    const limit = Math.min(sheet.rows.length, GRID_MAX_ROWS_PER_SHEET)

    for (let r = 0; r < limit; r++) {
      const raw = sheet.rows[r] ?? []
      const cells = raw.slice(0, GRID_MAX_COLS).map(cellText)
      while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop()
      if (isBlankRow(cells)) continue
      lines.push(`${r + 1} | ${cells.join(' | ')}`)
      emitted++
    }

    if (sheet.rows.length > limit) {
      truncated.push(
        `Sheet "${sheet.name}": chỉ đọc ${limit}/${sheet.rows.length} dòng đầu`,
      )
    }
    if (emitted === 0) continue

    const widest = Math.min(
      GRID_MAX_COLS,
      sheet.rows.reduce((m, row) => Math.max(m, row?.length ?? 0), 0),
    )
    const block = `=== Sheet "${sheet.name}" (cột A..${colLetter(Math.max(0, widest - 1))}) ===\n${lines.join('\n')}`

    if (chars + block.length > GRID_MAX_CHARS) {
      truncated.push(`Sheet "${sheet.name}" chưa đọc (đã chạm trần dung lượng)`)
      stopped = true
      continue
    }
    chars += block.length + 2
    parts.push(block)
    used.push({ name: sheet.name, emitted })
  }

  return { text: parts.join('\n\n'), sheets: used, truncated }
}
