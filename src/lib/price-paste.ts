/**
 * DÁN ĐƠN GIÁ TỪ EXCEL — toán thuần, không DOM, không DB.
 *
 * Dùng cho màn "Điền đơn giá" (/sales/orders/gia): Sale bôi 2–3 cột trong file
 * đơn của khách, dán vào, hệ thống khớp về đúng dòng đơn hàng.
 *
 * VÌ SAO TÁCH RA FILE RIÊNG + CÓ TEST: đây là toán TIỀN. Đọc sai một dấu phân
 * cách là đơn giá lệch 1000 lần, mà số đó chảy thẳng vào doanh số và bảng tin
 * Giám đốc. CLAUDE.md bắt buộc test cho loại logic này.
 *
 * QUYẾT ĐỊNH QUAN TRỌNG — KHÔNG TỰ ĐOÁN DẤU THẬP PHÂN:
 * "1.200" là 1200 (Excel vi-VN) hay 1,2 (Excel en-US)? Không có cách nào biết
 * chắc từ một mình chuỗi đó. Nên hàm này KHÔNG đoán: người dán chọn dấu thập
 * phân một lần cho cả khối (`decimalSep`), UI hiện bảng xem trước + tổng tiền để
 * mắt người soát lại. `guessDecimalSep` chỉ để CHỌN SẴN cái nút, không phải để
 * quyết thay người dùng.
 */

export type DecimalSep = '.' | ','

/** Một dòng đã tách được từ text dán. */
export type ParsedPriceRow = {
  /** Số dòng trong khối dán (1-based) — để chỉ đúng chỗ khi báo lỗi. */
  line: number
  /** Mã đơn hàng nếu người dán có cột đó; null = để hệ thống tự tìm theo mã SP. */
  order_code: string | null
  product_code: string
  price: number
}

export type ParsePriceError = {
  line: number
  text: string
  reason: string
}

export type ParsePriceResult = {
  rows: ParsedPriceRow[]
  errors: ParsePriceError[]
}

/**
 * Tách ô theo TAB (Excel copy ra tab) hoặc dấu `;`. Cố ý KHÔNG tách theo dấu
 * phẩy: phẩy còn là dấu phân cách số, tách theo nó thì "1,200" thành hai ô.
 */
function splitCells(line: string): string[] {
  const sep = line.includes('\t') ? '\t' : ';'
  return line.split(sep).map((c) => c.trim())
}

/**
 * Đổi text thành số tiền theo dấu thập phân ĐÃ CHỌN. Mọi dấu phân cách khác bị
 * coi là dấu hàng nghìn và bỏ đi. Trả `null` nếu không phải số.
 *
 * Chấp nhận: "1.234,56" · "1,234.56" · "12" · "$12.5" · "12 500" · "(rỗng)"→null
 */
export function parsePriceText(raw: string, decimalSep: DecimalSep): number | null {
  // Bỏ ký hiệu tiền tệ, khoảng trắng (kể cả no-break space từ Excel), dấu nháy.
  let s = raw.replace(/[\s  '"]/g, '').replace(/[$€₫]|VND|USD|EUR/gi, '')
  if (!s) return null

  // Số âm trong ngoặc kiểu kế toán: (1.200) = -1200. Không dùng cho đơn giá,
  // nhưng nhận ra để BÁO LỖI thay vì đọc thành 1200.
  const negative = /^\(.*\)$/.test(s) || s.startsWith('-')
  s = s.replace(/^\(|\)$/g, '').replace(/^-/, '')

  const thousandsSep = decimalSep === '.' ? ',' : '.'
  s = s.split(thousandsSep).join('')
  if (decimalSep === ',') s = s.replace(',', '.')

  // Sau khi dọn, chỉ được còn chữ số và tối đa một dấu chấm.
  if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

/**
 * Đoán dấu thập phân của cả khối để CHỌN SẴN nút trên UI.
 *
 * Luật: chỉ tin khi có bằng chứng rõ — ô nào có ĐỦ CẢ HAI dấu thì dấu xuất hiện
 * SAU CÙNG là dấu thập phân. Không có ô nào như vậy thì trả '.' (đơn giá xuất
 * khẩu của công ty là USD, file khách gửi gần như luôn dùng chuẩn Anh–Mỹ).
 */
export function guessDecimalSep(text: string): DecimalSep {
  for (const cell of text.split(/\r?\n/).flatMap(splitCells)) {
    const dot = cell.lastIndexOf('.')
    const comma = cell.lastIndexOf(',')
    if (dot >= 0 && comma >= 0) return dot > comma ? '.' : ','
  }
  return '.'
}

/**
 * Tách khối text dán thành các dòng (mã đơn?, mã SP, giá).
 *
 * Nhận 2 dạng cột:
 *   - 2 ô  → `mã SP | giá`
 *   - ≥3 ô → `mã đơn | mã SP | giá` (ô thứ 4 trở đi bị bỏ qua — người ta hay
 *            bôi cả cột tên SP, số lượng… vào cùng)
 *
 * Dòng đầu là tiêu đề ("Mã SP", "Đơn giá"…) thì ô giá không phải số → vào
 * `errors` với lý do rõ ràng, không âm thầm bỏ.
 */
export function parsePricePaste(text: string, decimalSep: DecimalSep): ParsePriceResult {
  const rows: ParsedPriceRow[] = []
  const errors: ParsePriceError[] = []

  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = i + 1
    if (!raw.trim()) continue

    const cells = splitCells(raw).filter((c, idx, arr) => idx < arr.length || c !== '')
    if (cells.length < 2) {
      errors.push({
        line,
        text: raw.trim(),
        reason: 'Cần ít nhất 2 cột: mã sản phẩm và đơn giá',
      })
      continue
    }

    // Cột giá = ô thứ 2 (dạng 2 cột) hoặc ô thứ 3 (dạng có mã đơn).
    const hasOrder = cells.length >= 3
    const productCode = (hasOrder ? cells[1] : cells[0]) ?? ''
    const priceCell = (hasOrder ? cells[2] : cells[1]) ?? ''
    const orderCode = hasOrder ? cells[0] : null

    if (!productCode) {
      errors.push({ line, text: raw.trim(), reason: 'Thiếu mã sản phẩm' })
      continue
    }

    const price = parsePriceText(priceCell, decimalSep)
    if (price == null) {
      errors.push({
        line,
        text: raw.trim(),
        reason: `Không đọc được đơn giá từ "${priceCell}"`,
      })
      continue
    }
    if (price < 0) {
      errors.push({ line, text: raw.trim(), reason: 'Đơn giá âm' })
      continue
    }

    rows.push({
      line,
      order_code: orderCode || null,
      product_code: productCode,
      price,
    })
  }

  return { rows, errors }
}

// ── Khớp dòng dán về dòng đơn hàng thật ─────────────────────────────────────

/** Dòng đơn hàng tối giản cần để khớp — màn thật truyền thêm field cũng không sao. */
export type MatchTarget = {
  line_id: string
  order_code: string
  product_code: string
}

export type PriceMatch = {
  line_id: string
  price: number
  /** Dòng nào trong khối dán đã tạo ra thay đổi này. */
  from_line: number
}

export type MatchResult = {
  matched: PriceMatch[]
  /** Không tìm thấy dòng đơn nào khớp. */
  unmatched: { line: number; product_code: string; order_code: string | null }[]
  /** Khớp nhiều dòng đơn → KHÔNG áp, buộc người dán thêm cột mã đơn. */
  ambiguous: {
    line: number
    product_code: string
    order_codes: string[]
  }[]
}

/**
 * Khớp kết quả dán về `line_id` thật.
 *
 * So mã KHÔNG phân biệt hoa/thường và bỏ khoảng trắng hai đầu — mã SP trong file
 * khách hay viết lệch kiểu "PT-138" vs "pt-138 ".
 *
 * MỘT MÃ SP TRÙNG Ở NHIỀU ĐƠN mà dòng dán không ghi mã đơn → xếp vào
 * `ambiguous`, KHÔNG đoán bừa. Áp giá của đơn A sang đơn B là sai âm thầm, tệ
 * hơn hẳn việc bắt người dán bôi thêm một cột.
 */
export function matchPasteRows(
  targets: readonly MatchTarget[],
  parsed: readonly ParsedPriceRow[],
): MatchResult {
  const key = (s: string) => s.trim().toLowerCase()

  const byProduct = new Map<string, MatchTarget[]>()
  const byOrderProduct = new Map<string, MatchTarget>()
  for (const t of targets) {
    const p = key(t.product_code)
    const list = byProduct.get(p)
    if (list) list.push(t)
    else byProduct.set(p, [t])
    byOrderProduct.set(`${key(t.order_code)}|${p}`, t)
  }

  const matched: PriceMatch[] = []
  const unmatched: MatchResult['unmatched'] = []
  const ambiguous: MatchResult['ambiguous'] = []

  for (const r of parsed) {
    if (r.order_code) {
      const hit = byOrderProduct.get(`${key(r.order_code)}|${key(r.product_code)}`)
      if (hit) {
        matched.push({ line_id: hit.line_id, price: r.price, from_line: r.line })
      } else {
        unmatched.push({
          line: r.line,
          product_code: r.product_code,
          order_code: r.order_code,
        })
      }
      continue
    }

    const hits = byProduct.get(key(r.product_code)) ?? []
    if (hits.length === 1) {
      matched.push({ line_id: hits[0].line_id, price: r.price, from_line: r.line })
    } else if (hits.length === 0) {
      unmatched.push({ line: r.line, product_code: r.product_code, order_code: null })
    } else {
      ambiguous.push({
        line: r.line,
        product_code: r.product_code,
        order_codes: [...new Set(hits.map((h) => h.order_code))].sort(),
      })
    }
  }

  return { matched, unmatched, ambiguous }
}
