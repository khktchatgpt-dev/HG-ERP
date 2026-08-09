// BÓC DỮ LIỆU THAM CHIẾU từ các file đơn đặt hàng Excel thật của phòng Cung ứng
// (LSX 01→04 mùa 26-27) đổ vào danh mục, phục vụ go-live form soạn đơn:
//
//   · NCC        — MST, địa chỉ, SĐT/người liên hệ, điều khoản thanh toán
//                  (đầu mỗi sheet đơn). CHỈ ĐIỀN Ô TRỐNG, không đè số đang có,
//                  KHÔNG tự tạo NCC mới (tên viết tay dễ đẻ trùng — chỉ báo).
//   · Vật tư     — giá mua gần nhất (last_purchase_price), kg/đơn-vị
//                  (kg/cây, kg/tấm — đơn inox/nhôm tấm), kg/m (đơn nhôm cây).
//                  Cũng chỉ điền ô trống. Khớp tên bằng ĐÚNG bộ khoá server
//                  đang dùng để chặn trùng (src/lib/material-key.ts): mức
//                  "chắc chắn" tự áp; mức mờ (namesAlike) chỉ áp khi duy nhất
//                  một ứng viên; còn lại in ra cho người rà.
//
//   node scripts/import-po-file-refs.mjs            # dry-run: chỉ in
//   node scripts/import-po-file-refs.mjs --apply    # ghi vào DB
//
// Nhiều file cùng chào giá một vật tư → lấy giá của sheet có NGÀY MỚI NHẤT
// (đọc "ngày … tháng … năm …" ở đầu sheet; không đọc được thì theo thứ tự file).

import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'
import { sureKey, namesAlike, MIN_KEY_LEN, nod } from '../src/lib/material-key.ts'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const APPLY = process.argv.includes('--apply')
const DL = 'C:/Users/HP/Downloads'
// Thứ tự ≈ thời gian (LSX 01 → 04) — dùng làm tie-break khi sheet không có ngày.
const FILES = [
  `${DL}/Copy of LSX 01.26.27( 17976 HG-MX) 1.xlsx`,
  `${DL}/THEO DÕI  VẬT TƯ - LSX 01.26.xlsx`,
  `${DL}/Copy of LSX 02.26.27( 17984 HG-MX).xlsx`,
  `${DL}/THEO DÕI VẬT TƯ - LSX 02.26.xlsx`,
  `${DL}/Copy of LSX 03.26.27( 17994 HG-MX).xls`,
  `${DL}/LSX 04 + BẢNG KÊ VT.xlsx`,
]

// ── Đọc sheet thành lưới chuỗi ──────────────────────────────────────────────

function grid(ws) {
  if (!ws['!ref']) return []
  const range = XLSX.utils.decode_range(ws['!ref'])
  const rows = []
  for (let r = range.s.r; r <= Math.min(range.e.r, 250); r++) {
    const row = []
    for (let c = range.s.c; c <= Math.min(range.e.c, 30); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })]
      row[c] = cell?.v ?? null
    }
    rows[r] = row
  }
  return rows
}

const s = (v) => (v == null ? '' : String(v).trim())
const oneLine = (v) => s(v).replace(/\s*\n\s*/g, ' ')
const numOf = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** "ngày 27 tháng 7 năm 2026" / "Ngày 30/7/2026" → 'YYYY-MM-DD' (sort được). */
function sheetDate(rows) {
  for (const row of rows.slice(0, 6)) {
    if (!row) continue
    for (const cell of row) {
      const t = s(cell)
      let m = t.match(/ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})\s+năm\s+(\d{4})/i)
      if (!m) m = t.match(/ngày\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
      if (m) {
        return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`
      }
    }
  }
  return null
}

/** Giá trị đứng sau nhãn: cùng ô sau dấu ':', hoặc ô kế bên phải có chữ. */
function labelValue(rows, re) {
  for (const row of rows.slice(0, 15)) {
    if (!row) continue
    for (let c = 0; c < row.length; c++) {
      const t = oneLine(row[c])
      const m = t.match(re)
      if (!m) continue
      const inline = t.slice(m.index + m[0].length).replace(/^[:\s]+/, '')
      if (inline) return inline
      for (let k = c + 1; k < row.length; k++) {
        if (s(row[k])) return oneLine(row[k])
      }
    }
  }
  return null
}

// ── Bóc 1 sheet đơn ─────────────────────────────────────────────────────────

function parseOrderSheet(rows) {
  const flat = rows.slice(0, 10).flat().map(oneLine)
  const isOrder =
    flat.some((t) => /^ĐƠN ĐẶT HÀNG/i.test(t)) &&
    rows.slice(0, 15).some((row) => row?.some((v) => /kính gửi/i.test(s(v))))
  if (!isOrder) return null

  const supplier = {
    name: labelValue(rows, /kính gửi/i),
    address: labelValue(rows, /^địa chỉ/i),
    tax_no: (labelValue(rows, /^MST/i) ?? '').replace(/[^\d]/g, '') || null,
    phone: labelValue(rows, /người liên hệ/i) ?? labelValue(rows, /^ĐT(?![A-Za-zÀ-ỹ])/i),
    payment: labelValue(rows, /hình thức thanh toán|^chuyển tiền/i),
  }
  if (!supplier.name) return null

  // Header bảng dòng: có "Đơn giá" + một cột tên hàng.
  let head = -1
  let cols = null
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    const find = (re) => row.findIndex((v) => re.test(oneLine(v)))
    const price = find(/^đơn\s*giá/i)
    if (price < 0) continue
    /*
     * CỘT TÊN VẬT TƯ — thứ tự ưu tiên quan trọng: sheet nhôm/inox có HAI cột
     * tên ("Tên Sp" = sản phẩm hoàn thiện, "Chi tiết"/"Tên hàng hóa"/"Chủng
     * Loại" = vật tư thật sự đặt). Bắt nhầm cột sản phẩm là "Bồn hoa" đi khớp
     * mờ vào "Ben hơi" trong danh mục (ca thật ở dry-run đầu).
     */
    const name = [
      find(/tên hàng hóa|chủng loại/i),
      find(/chi tiết/i),
      find(/tên (sản phẩm|vật tư)|tên sp/i),
    ].find((i) => i >= 0)
    if (name == null || name < 0) continue
    cols = {
      name,
      price,
      unit: find(/^đ?vt$/i),
      kgUnit: find(/trọng lượng (cây|tấm)|kg\/tấm/i),
      kgM: find(/kg\/m$|trọng lượng\s*kg\/m/i),
    }
    head = r
    break
  }
  if (head < 0) return { supplier, lines: [] }

  const lines = []
  for (let r = head + 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row) continue
    if (
      row.some((v) => /cộng tiền|tổng cộng|tổng thanh toán|tổng thành tiền/i.test(s(v)))
    )
      break
    const name = oneLine(row[cols.name])
    if (!name || name.length < 3) continue
    lines.push({
      name,
      price: numOf(row[cols.price]),
      unit: cols.unit >= 0 ? s(row[cols.unit]) : '',
      kg_per_unit: cols.kgUnit >= 0 ? numOf(row[cols.kgUnit]) : null,
      kg_per_m: cols.kgM >= 0 ? numOf(row[cols.kgM]) : null,
    })
  }
  return { supplier, lines }
}

// ── Gom từ 6 file ───────────────────────────────────────────────────────────

const orders = [] // {file, sheet, date, order, supplier, lines}
for (let fi = 0; fi < FILES.length; fi++) {
  const wb = XLSX.readFile(FILES[fi])
  for (const sheetName of wb.SheetNames) {
    const rows = grid(wb.Sheets[sheetName])
    const parsed = parseOrderSheet(rows)
    if (!parsed) continue
    orders.push({
      file: FILES[fi].split('/').pop(),
      sheet: sheetName,
      order: fi,
      date: sheetDate(rows),
      ...parsed,
    })
  }
}
console.log(`Đọc được ${orders.length} sheet đơn từ ${FILES.length} file.`)

// ── Khớp & cập nhật NCC ─────────────────────────────────────────────────────

const db = await client(import.meta.url)

const { data: sups, error: se } = await db
  .from('supply_suppliers')
  .select('id, name, tax_no, address, phone, payment_terms')
  .limit(2000)
if (se) throw new Error(se.message)

// Tên NCC bỏ tiền tố loại hình để so ("CÔNG TY TNHH SX TM TH AN THÀNH PHÁT"
// với "Cty TNHH An Thành Phát" phải gặp nhau).
const coreName = (t) =>
  nod(t)
    .replace(
      /\b(cong ty|cty|co phan|cp|tnhh|dntn|doanh nghiep tu nhan|sx|tm|dv|th|xnk|xuat nhap khau|san xuat|thuong mai|dich vu|tong hop|mtv|một thanh vien)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const supPatch = new Map() // id -> patch
const supMatched = new Map() // key sheet-supplier name -> supplier row (dùng lại)
const supUnmatched = new Map()
for (const o of orders) {
  const pName = coreName(o.supplier.name)
  if (!pName) continue
  let hit =
    (o.supplier.tax_no && sups.find((x) => x.tax_no === o.supplier.tax_no)) ||
    sups.find((x) => {
      const c = coreName(x.name)
      return c && (c === pName || c.includes(pName) || pName.includes(c))
    })
  if (!hit) {
    supUnmatched.set(pName, o.supplier)
    continue
  }
  supMatched.set(o.sheet + '|' + o.file, hit)
  const patch = supPatch.get(hit.id) ?? {}
  const fill = (field, value) => {
    if (value && !s(hit[field]) && !patch[field]) patch[field] = value
  }
  fill('tax_no', o.supplier.tax_no)
  fill('address', o.supplier.address)
  fill('phone', o.supplier.phone)
  fill('payment_terms', o.supplier.payment)
  if (Object.keys(patch).length) supPatch.set(hit.id, patch)
}

console.log(`\n── NCC ─────────────────────────────`)
for (const [id, patch] of supPatch) {
  const sup = sups.find((x) => x.id === id)
  console.log(`  ✎ ${sup.name}: điền ${Object.keys(patch).join(', ')}`)
}
if (supPatch.size === 0) console.log('  (không có ô trống nào điền được)')
console.log(`  Chưa khớp được ${supUnmatched.size} NCC (không tự tạo — rà tay):`)
for (const [, info] of supUnmatched) console.log(`    ? ${info.name}`)

// ── Khớp & cập nhật vật tư ──────────────────────────────────────────────────

const mats = []
for (let fromRow = 0; ; fromRow += 1000) {
  const { data, error } = await db
    .from('warehouse_materials')
    .select('id, code, name, group_name, last_purchase_price, kg_per_m, kg_per_unit')
    .order('code')
    .range(fromRow, fromRow + 999)
  if (error) throw new Error(error.message)
  mats.push(...data)
  if (data.length < 1000) break
}
console.log(`\nDanh mục: ${mats.length} vật tư.`)

const byKey = new Map()
for (const m of mats) {
  const k = sureKey(m.name)
  if (k.length < MIN_KEY_LEN) continue
  ;(byKey.get(k) ?? byKey.set(k, []).get(k)).push(m)
}

function matchMaterial(name) {
  const k = sureKey(name)
  if (k.length < MIN_KEY_LEN) return null
  const sure = byKey.get(k)
  // Nhiều mã cùng khoá = tên trùng CHÉO NHÓM ("Hộp 25x50x1" có cả bản inox lẫn
  // nhôm, giá chênh nhiều lần) — máy không tự chọn, để người rà.
  if (sure?.length === 1) return { m: sure[0], how: 'chắc' }
  if (sure?.length > 1) return { ambiguous: sure }
  // Mờ: chỉ nhận khi DUY NHẤT một ứng viên — hai ứng viên là để người rà.
  const alike = mats.filter((m) => namesAlike(name, m.name))
  if (alike.length === 1) return { m: alike[0], how: 'mờ' }
  return null
}

/**
 * Số cân đi kèm dòng KIM LOẠI phải rơi vào vật tư đúng nhóm: kg/m của đơn nhôm
 * mà ghi vào mã inox trùng tên là trồng một con số sai trông như thật. Nhóm
 * lệch → coi như KHÔNG khớp (cả giá cũng bỏ — bản khớp đã đáng ngờ).
 */
function groupOkForLine(line, material) {
  const g = nod(material.group_name)
  if (line.kg_per_m > 0) return /nhom/.test(g)
  if (line.kg_per_unit > 0) return /nhom|inox|sat|thep/.test(g)
  return true
}

// Gom đề xuất theo vật tư — sheet mới nhất thắng.
const prop = new Map() // material_id -> {m, price, kgU, kgM, src, sort}
let unmatchedLines = []
for (const o of orders) {
  const sortKey = `${o.date ?? '0000-00-00'}|${String(o.order).padStart(2, '0')}`
  for (const l of o.lines) {
    if (!(l.price > 0) && !(l.kg_per_unit > 0) && !(l.kg_per_m > 0)) continue
    const hit = matchMaterial(l.name)
    if (!hit || hit.ambiguous || !groupOkForLine(l, hit.m)) {
      if (l.price > 0 || l.kg_per_m > 0 || l.kg_per_unit > 0) {
        unmatchedLines.push({
          name: hit?.ambiguous
            ? `${l.name}  [trùng ${hit.ambiguous.length} mã: ${hit.ambiguous.map((m) => m.code).join(', ')}]`
            : hit
              ? `${l.name}  [khớp ${hit.m.code} nhưng lệch nhóm ${hit.m.group_name ?? '—'}]`
              : l.name,
          sheet: o.sheet,
          file: o.file,
        })
      }
      continue
    }
    const cur = prop.get(hit.m.id)
    if (cur && cur.sort > sortKey) continue
    prop.set(hit.m.id, {
      m: hit.m,
      how: hit.how,
      price: l.price > 0 ? l.price : (cur?.price ?? null),
      kgU: l.kg_per_unit > 0 ? l.kg_per_unit : (cur?.kgU ?? null),
      kgM: l.kg_per_m > 0 ? l.kg_per_m : (cur?.kgM ?? null),
      src: `${o.sheet} (${o.file})`,
      sort: sortKey,
    })
  }
}

console.log(`\n── VẬT TƯ ──────────────────────────`)
const matPatch = []
for (const p of prop.values()) {
  const patch = {}
  if (p.price != null && p.m.last_purchase_price == null)
    patch.last_purchase_price = p.price
  if (p.kgU != null && p.m.kg_per_unit == null) patch.kg_per_unit = p.kgU
  if (p.kgM != null && p.m.kg_per_m == null) patch.kg_per_m = p.kgM
  if (!Object.keys(patch).length) continue
  matPatch.push({ id: p.m.id, patch })
  console.log(
    `  ✎ [${p.how}] ${p.m.code} ${p.m.name} ← ${Object.entries(patch)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ')}  (${p.src})`,
  )
}
console.log(
  `\n  Điền được ${matPatch.length} vật tư · ${unmatchedLines.length} dòng có giá nhưng chưa khớp tên:`,
)
const seen = new Set()
for (const u of unmatchedLines) {
  const k = sureKey(u.name)
  if (seen.has(k)) continue
  seen.add(k)
  console.log(`    ? "${u.name}"  (${u.sheet} — ${u.file})`)
}

// ── Ghi ─────────────────────────────────────────────────────────────────────

if (!APPLY) {
  console.log('\nDry-run — chạy lại với --apply để ghi vào DB.')
  process.exit(0)
}
for (const [id, patch] of supPatch) {
  const { error } = await db.from('supply_suppliers').update(patch).eq('id', id)
  if (error) throw new Error(`supplier ${id}: ${error.message}`)
}
for (const { id, patch } of matPatch) {
  const { error } = await db.from('warehouse_materials').update(patch).eq('id', id)
  if (error) throw new Error(`material ${id}: ${error.message}`)
}
console.log(`\n✓ Đã ghi: ${supPatch.size} NCC, ${matPatch.length} vật tư.`)
