/**
 * Đọc một vùng dán từ Excel thành DÒNG ĐƠN HÀNG — logic THUẦN cho form đơn
 * (`OrderForm`). Sinh ra vì 71/71 dòng của 20 đơn đầu tiên vào hệ thống với giá
 * 0: chúng được nạp từ 8 file LỆNH SẢN XUẤT, mà file lệnh không mang giá bán
 * (xem `scripts/lsx-sales-import.mjs`). Gõ tay lại từng dòng vừa chậm vừa dễ sai
 * một chữ số — dán thẳng từ file của Sale thì không.
 *
 * Nguyên tắc như bộ dán BOM: chỉ ĐIỀN SẴN vào lưới, không ghi DB; dòng nào không
 * khớp được sản phẩm thì BÁO RA, không im lặng nuốt.
 *
 * Khớp sản phẩm theo thứ tự: mã SP nội bộ → mã SP của khách
 * (`customer_item_code`) → tên. Đơn của khách nước ngoài thường chỉ có mã của
 * khách, nên nhánh thứ hai là nhánh dùng nhiều nhất.
 */

export type PasteProduct = {
  id: string
  code: string
  name: string
  customer_item_code: string | null
}

/** Một dòng đọc được từ vùng dán, đã khớp (hoặc không khớp) sản phẩm. */
export type OrderPasteRow = {
  line: number
  /** Chuỗi gốc ở ô mã/tên — hiện lại để người dán đối chiếu. */
  raw_key: string
  product_id: string | null
  product_label: string | null
  qty: number | null
  unit_price: number | null
  note: string | null
  /** Khớp được nhiều SP → phải để người dán tự chọn, không đoán bừa. */
  ambiguous: boolean
}

export type OrderPasteResult = {
  rows: OrderPasteRow[]
  skipped: { line: number; text: string; reason: string }[]
  mapped: { index: number; label: string }[]
  source: 'header' | 'guess'
}

type Field = 'key' | 'qty' | 'unit_price' | 'note' | 'skip'

const FIELD_LABEL: Record<Field, string> = {
  key: 'Mã / tên SP',
  qty: 'Số lượng',
  unit_price: 'Đơn giá',
  note: 'Ghi chú',
  skip: '—',
}

/**
 * Số kiểu Excel. Cẩn thận hai quy ước lẫn nhau: "1.234,56" (VN) và "1,234.56"
 * (Anh–Mỹ, hay gặp trên đơn xuất khẩu). Quyết theo dấu NẰM SAU CÙNG — dấu đó là
 * dấu thập phân, dấu còn lại là phân nhóm nghìn.
 */
export function parseMoney(v: string | undefined): number | null {
  if (v == null) return null
  const s = String(v)
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '')
  if (!s) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized = s
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? s.replace(/\./g, '').replace(',', '.') // 1.234,56
        : s.replace(/,/g, '') // 1,234.56
  } else if (lastComma >= 0) {
    // Chỉ có dấu phẩy: 3 chữ số phía sau ⇒ phân nhóm nghìn ("1,200"), còn lại là
    // thập phân ("12,5"). Đoán sai chỗ này là lệch giá 1000 lần.
    normalized = /,\d{3}$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.')
  } else if (lastDot >= 0) {
    normalized =
      /\.\d{3}$/.test(s) && s.replace(/[^\d]/g, '').length > 3 ? s.replace(/\./g, '') : s
  }
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

const txt = (v: string | undefined): string | null => {
  const s = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return s || null
}

const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()

/** Bỏ dấu, bỏ mọi ký tự không phải chữ-số — so mã "PT 138/155" ≡ "pt138155". */
const keyOf = (s: string) => noAccent(s).replace(/[^a-z0-9]/g, '')

const HEADER_RULES: [RegExp, Field][] = [
  [/thanh tien|^tt$|^amount$|total/, 'skip'],
  [/^stt$|^tt$|^no\.?$/, 'skip'],
  [/don gia|^gia$|unit ?price|^price$|^dgia$/, 'unit_price'],
  [/so luong|^sl$|^qty$|quantity|^q'?ty$/, 'qty'],
  [/ma sp|ma hang|item ?code|^ma$|^code$|model|ten sp|ten hang|description|^ten$/, 'key'],
  [/ghi chu|^note$|remark/, 'note'],
]

function fieldOfHeader(cell: string): Field | null {
  const s = noAccent(cell).trim()
  if (!s) return null
  for (const [re, f] of HEADER_RULES) if (re.test(s)) return f
  return null
}

function readHeader(cells: string[]): Map<number, Field> | null {
  const hits = new Map<number, Field>()
  let numeric = 0
  cells.forEach((c, i) => {
    if (!txt(c)) return
    if (/^\s*[\d.,-]+\s*$/.test(c)) numeric++
    const f = fieldOfHeader(c)
    if (f) hits.set(i, f)
  })
  if (numeric > 0) return null
  // Cần ít nhất 2 cột nhận ra được VÀ phải có cột khoá — thiếu khoá thì không
  // biết dán vào dòng nào.
  const hasKey = [...hits.values()].includes('key')
  return hits.size >= 2 && hasKey ? hits : null
}

/**
 * Không có tiêu đề: cột đầu tiên KHÔNG phải số là cột mã/tên; các cột số còn lại
 * lần lượt là SL rồi ĐƠN GIÁ. Chỉ một cột số thì coi là ĐƠN GIÁ — vì ca dùng
 * chính của bộ dán này là bù giá cho đơn đã có sẵn số lượng.
 */
function guessMap(grids: string[][]): Map<number, Field> {
  const m = new Map<number, Field>()
  const width = Math.max(0, ...grids.map((g) => g.length))
  const isNumCol = (c: number) => {
    const vals = grids.map((g) => g[c]).filter((v) => txt(v))
    if (vals.length === 0) return false
    return vals.every((v) => /^[\d.,\s-]+$/.test(v))
  }

  let keyCol = -1
  for (let c = 0; c < width; c++) {
    if (!isNumCol(c)) {
      keyCol = c
      break
    }
  }
  if (keyCol < 0) return m
  m.set(keyCol, 'key')

  const numCols: number[] = []
  for (let c = keyCol + 1; c < width; c++) if (isNumCol(c)) numCols.push(c)
  if (numCols.length === 1) m.set(numCols[0], 'unit_price')
  else if (numCols.length >= 2) {
    m.set(numCols[0], 'qty')
    m.set(numCols[1], 'unit_price')
  }
  return m
}

function isNoise(cells: string[]): string | null {
  const joined = noAccent(cells.join(' ')).trim()
  if (!joined) return 'dòng trống'
  if (/^tong cong|^tong\b|^total\b|^grand total/.test(joined)) return 'dòng tổng cộng'
  return null
}

/** Tra sản phẩm theo mã nội bộ → mã của khách → tên. */
function matchProduct(
  raw: string,
  products: PasteProduct[],
): { list: PasteProduct[]; by: 'code' | 'customer' | 'name' | null } {
  const k = keyOf(raw)
  if (!k) return { list: [], by: null }

  const byCode = products.filter((p) => keyOf(p.code) === k)
  if (byCode.length) return { list: byCode, by: 'code' }

  const byCustomer = products.filter(
    (p) => p.customer_item_code && keyOf(p.customer_item_code) === k,
  )
  if (byCustomer.length) return { list: byCustomer, by: 'customer' }

  const byName = products.filter((p) => keyOf(p.name) === k)
  if (byName.length) return { list: byName, by: 'name' }

  return { list: [], by: null }
}

export function parseOrderPaste(
  text: string,
  products: PasteProduct[],
): OrderPasteResult {
  const lines = String(text ?? '').split(/\r?\n/)
  const split = (l: string) =>
    l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : l.split(/ {2,}/)

  const grids = lines.map(split)
  const skipped: OrderPasteResult['skipped'] = []

  let map: Map<number, Field> | null = null
  let bodyFrom = 0
  for (let i = 0; i < Math.min(grids.length, 4); i++) {
    const h = readHeader(grids[i])
    if (!h) {
      if (map) break
      continue
    }
    map = h
    bodyFrom = i + 1
    skipped.push({
      line: i + 1,
      text: grids[i].join(' | ').slice(0, 80),
      reason: 'dòng tiêu đề',
    })
    break
  }

  const source: OrderPasteResult['source'] = map ? 'header' : 'guess'
  const body = grids.slice(bodyFrom)
  const finalMap = map ?? guessMap(body.filter((g) => g.some(Boolean)))

  const rows: OrderPasteRow[] = []
  body.forEach((cells, i) => {
    const lineNo = bodyFrom + i + 1
    const noise = isNoise(cells)
    if (noise) {
      if (cells.some(Boolean))
        skipped.push({
          line: lineNo,
          text: cells.join(' | ').slice(0, 80),
          reason: noise,
        })
      return
    }

    let rawKey = ''
    let qty: number | null = null
    let price: number | null = null
    let note: string | null = null
    for (const [idx, field] of finalMap) {
      const cell = cells[idx]
      if (field === 'key') rawKey = txt(cell) ?? ''
      else if (field === 'qty') qty = parseMoney(cell)
      else if (field === 'unit_price') price = parseMoney(cell)
      else if (field === 'note') note = txt(cell)
    }

    if (!rawKey) {
      skipped.push({
        line: lineNo,
        text: cells.join(' | ').slice(0, 80),
        reason: 'không có mã / tên sản phẩm',
      })
      return
    }

    const { list } = matchProduct(rawKey, products)
    rows.push({
      line: lineNo,
      raw_key: rawKey,
      product_id: list.length === 1 ? list[0].id : null,
      product_label: list.length === 1 ? `${list[0].code} — ${list[0].name}` : null,
      qty,
      unit_price: price,
      note,
      ambiguous: list.length > 1,
    })
  })

  const mapped = [...finalMap.entries()]
    .filter(([, f]) => f !== 'skip')
    .sort((a, b) => a[0] - b[0])
    .map(([index, field]) => ({ index, label: FIELD_LABEL[field] }))

  return { rows, skipped, mapped, source }
}
