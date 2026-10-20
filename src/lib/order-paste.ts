/**
 * DÁN DÒNG ĐƠN TỪ EXCEL (07/10/2026, tầng 3 form đơn — khuôn F).
 *
 * Sổ thật của Sale ("order HG 2026-2027.xlsx"): ART.No | QUANTITY | SHIPMENT
 * (w37.26) | … Người dùng bôi vài cột rồi dán vào lưới. Logic thuần: tách TAB /
 * `;`, nhận cột theo tiêu đề nếu có, không thì ĐOÁN theo hình dạng ô (mã = chữ
 * không phải số, SL = số nguyên đầu tiên, giá = số có lẻ / số thứ hai, tuần =
 * `w37.26` hoặc `dd/mm/yyyy`). Mỗi dòng ra một việc, lỗi chỉ đúng dòng. Không
 * tra DB — tra mã là việc của người gọi.
 */
import { guessDecimalSep, parsePriceText, type DecimalSep } from './price-paste'
import { vnToIso } from './date-vn'

export type PastedOrderRow = {
  line: number
  code: string
  qty: number | null
  unit_price: number | null
  ship_date: string | null
  note: string | null
}
export type PasteOrderError = { line: number; text: string; reason: string }
export type PasteOrderResult = {
  rows: PastedOrderRow[]
  errors: PasteOrderError[]
  decimalSep: DecimalSep
}

const split = (line: string) => {
  const sep = line.includes('\t') ? '\t' : ';'
  return line.split(sep).map((c) => c.trim())
}

/** Chủ nhật (ngày cuối) của tuần ISO `week` năm `year` — nghịch đảo của `shipWeekLabel`. */
export function isoWeekEnd(week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = (jan4.getUTCDay() + 6) % 7
  const week1Mon = Date.UTC(year, 0, 4 - jan4Day)
  const sunday = new Date(week1Mon + ((week - 1) * 7 + 6) * 86_400_000)
  return sunday.toISOString().slice(0, 10)
}

/** 'w37.26' / 'W37.2026' / '37.26' → ngày cuối tuần ISO; dd/mm/yyyy → ISO; yyyy-mm-dd giữ. */
export function parseShipCell(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const vn = vnToIso(s)
  if (vn) return vn
  const w = /^w?(\d{1,2})[.\-/](\d{2}|\d{4})$/i.exec(s)
  if (w) {
    const week = Number(w[1])
    const year = w[2].length === 2 ? 2000 + Number(w[2]) : Number(w[2])
    if (week >= 1 && week <= 53) return isoWeekEnd(week, year)
  }
  return null
}

const looksNumeric = (s: string) =>
  /^[\s$€₫()'"-]*[\d.,\s]+[\s$€₫'"]*(USD|VND|EUR)?$/i.test(s) && /\d/.test(s)
const looksShip = (s: string) => parseShipCell(s) != null
const HEAD = {
  code: /^(m[aã]|art|item|sku|code|product|sp|m[aã] (kh|hg|sp))/i,
  qty: /^(sl|s[ốo] l|qty|quantity|q'?ty)/i,
  price: /^(gi[aá]|price|đơn gi|unit)/i,
  ship: /^(tu[aầ]n|ship|w|ng[aà]y|giao|etd|date)/i,
  note: /^(ghi|note|remark)/i,
}

type ColMap = { code: number; qty: number; price: number; ship: number; note: number }

function mapByHeader(cells: string[]): ColMap | null {
  const m: ColMap = { code: -1, qty: -1, price: -1, ship: -1, note: -1 }
  let hits = 0
  cells.forEach((c, i) => {
    for (const k of Object.keys(HEAD) as (keyof typeof HEAD)[]) {
      if (m[k] < 0 && HEAD[k].test(c)) {
        m[k] = i
        hits++
        break
      }
    }
  })
  return hits >= 2 && m.code >= 0 ? m : null
}

/** Đoán cột theo hình dạng ô của dòng dữ liệu đầu tiên. */
function guessCols(cells: string[]): ColMap {
  const m: ColMap = { code: -1, qty: -1, price: -1, ship: -1, note: -1 }
  const nums: number[] = []
  cells.forEach((c, i) => {
    if (!c) return
    if (looksShip(c) && m.ship < 0 && !/^\d+([.,]\d+)?$/.test(c)) m.ship = i
    else if (looksNumeric(c)) nums.push(i)
    else if (m.code < 0) m.code = i
    else if (m.note < 0) m.note = i
  })
  // Số nguyên đầu tiên = SL; số còn lại (hoặc số có lẻ) = giá.
  for (const i of nums) {
    const c = cells[i]
    const isInt = /^\d{1,3}([.,]\d{3})*$|^\d+$/.test(c.replace(/\s/g, ''))
    if (m.qty < 0 && isInt) m.qty = i
    else if (m.price < 0) m.price = i
    else if (m.qty < 0) m.qty = i
  }
  return m
}

/** Số nguyên kiểu VN: "1.390" = 1390, "1 200" = 1200, "12,5" → 12.5 (lẻ, hiếm cho SL). */
export function parseQtyCell(raw: string): number | null {
  const s = raw.replace(/\s/g, '')
  if (!s) return null
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ''))
  if (/^\d{1,3}(,\d{3})+$/.test(s)) return Number(s.replace(/,/g, ''))
  if (/^\d+$/.test(s)) return Number(s)
  const dec = Number(s.replace(',', '.'))
  return Number.isFinite(dec) ? dec : null
}

export function parseOrderPaste(text: string): PasteOrderResult {
  const lines = text.split(/\r?\n/)
  const rows: PastedOrderRow[] = []
  const errors: PasteOrderError[] = []
  const decimalSep = guessDecimalSep(text)
  let map: ColMap | null = null
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (!raw.trim()) continue
    const cells = split(raw)
    if (!map) {
      const byHead = mapByHeader(cells)
      if (byHead) {
        map = byHead
        continue // dòng tiêu đề
      }
      map = guessCols(cells)
      if (map.code < 0) {
        errors.push({ line: i + 1, text: raw, reason: 'Không thấy cột mã sản phẩm' })
        continue
      }
    }
    const code = (cells[map.code] ?? '').trim()
    if (!code) {
      errors.push({ line: i + 1, text: raw, reason: 'Thiếu mã sản phẩm' })
      continue
    }
    const qtyRaw = map.qty >= 0 ? (cells[map.qty] ?? '') : ''
    const qty = qtyRaw ? parseQtyCell(qtyRaw) : null
    if (qtyRaw && qty == null) {
      errors.push({
        line: i + 1,
        text: raw,
        reason: `Số lượng không đọc được: "${qtyRaw}"`,
      })
      continue
    }
    const priceRaw = map.price >= 0 ? (cells[map.price] ?? '') : ''
    const unit_price = priceRaw ? parsePriceText(priceRaw, decimalSep) : null
    if (priceRaw && unit_price == null) {
      errors.push({
        line: i + 1,
        text: raw,
        reason: `Đơn giá không đọc được: "${priceRaw}"`,
      })
      continue
    }
    const shipRaw = map.ship >= 0 ? (cells[map.ship] ?? '') : ''
    const ship_date = shipRaw ? parseShipCell(shipRaw) : null
    if (shipRaw && !ship_date) {
      errors.push({
        line: i + 1,
        text: raw,
        reason: `Tuần giao không đọc được: "${shipRaw}" (nhận w37.26 hoặc dd/mm/yyyy)`,
      })
      continue
    }
    rows.push({
      line: i + 1,
      code,
      qty,
      unit_price,
      ship_date,
      note: map.note >= 0 ? (cells[map.note] ?? '').trim() || null : null,
    })
  }
  return { rows, errors, decimalSep }
}
