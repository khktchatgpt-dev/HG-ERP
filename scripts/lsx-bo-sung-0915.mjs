// BỔ SUNG DỮ LIỆU LỆNH SẢN XUẤT — đợt rà 15/09/2026
//
//   node scripts/lsx-bo-sung-0915.mjs           # DRY-RUN, không ghi gì
//   node scripts/lsx-bo-sung-0915.mjs --apply   # ghi thật
//
// Đối chiếu 18 file LSX của 2 sale (ROSCO của Nguyễn T.Minh Hằng; MERXX/LAURA/
// GIGA/JAWOLL/BLACKIN của Nguyễn Phạm Thanh Phương) với DB, rồi bù phần thiếu:
//
//   1. Khách GIGA + BLACKIN chưa có trong danh mục; JAWOLL chưa gán sale.
//   2. 28 hồ sơ SP còn thiếu (mã HG cấp theo quy tắc `src/lib/product-code.ts`).
//   3. 5 lệnh chưa có: ROSCO 03, LAURA 02, MERXX 10, GIGA 01, BLACKIN 01 — dựng
//      ở trạng thái NHÁP, kèm nhóm theo PO và dòng lệnh.
//   4. Nối SP cho các dòng lệnh cũ đang bỏ trống product_id (MERXX 05/09,
//      JAWOLL 01, ROSCO 02).
//   5. Bù số PO cho nhóm của MERXX 05/07/08/09 (lấy từ tên file).
//   6. ROSCO 02 lên bản "Ver 2" ngày 03/09/2026 (6 dòng tăng, +610 sp).
//
// ĐÃ LÀM SAU, BẰNG TAY (chủ dự án chốt 15/09/2026) — không nằm trong script này:
//   - MERXX 06 hạ xuống bản REVISED: xoá 4 dòng (ST0218HG-IR 55, ST0219HG-IR 70,
//     ST0225HG-AL 90, 28256-228 20), kéo theo 119 dòng `production_components`
//     theo `on delete cascade`. Còn 22 dòng / 4.770 sp, revision lên 2. Sao lưu
//     trước khi xoá ở `backup-mx06-lines-20260915.json` (dòng + chi tiết + nhóm).
//   - MERXX 03 đổi số PO 17994 → 17996 theo tên file REVISED; đơn hàng đổi mã
//     `17994 HG-MX` → `17996 HG-MX`.
//   - Ngày xuất đọc theo NGÀY/THÁNG/NĂM: BLACKIN 01 → 11/10/2027; ROSCO 03 →
//     10/11/2026, 10/12/2026, 05/01/2027, 05/01/2027 (cả nhóm, dòng và đơn hàng).
//
// CỐ Ý KHÔNG LÀM:
//   - Chia lại LAURA 01 theo 16 PO: thứ tự dòng trong file KHÁC thứ tự dòng đã
//     nạp nên không ghép 1:1 an toàn được; muốn chia lại thì nạp lại cả lệnh.
//   - Đổi dòng 150 cái của MERXX 03 từ SP 22020-209 sang 22020-909: SP mới chưa
//     có định mức nên 36 dòng chi tiết hiện có sẽ treo. Chờ Kỹ thuật nhập định
//     mức rồi đổi.
//
// Idempotent: đã có thì bỏ qua, chạy lại không đẻ bản trùng.
import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'

const XLSX = createRequire(import.meta.url)('xlsx')
const APPLY = process.argv.includes('--apply')

const NV = 'C:/Users/HGPC/Downloads/nam việt'
const TP = 'C:/Users/HGPC/Downloads/thanh phương'
const SALE_PHUONG = 'e589c8de-66f5-48be-bf33-55bc2fa9fef9' // Nguyễn Phạm Thanh Phương
const SALE_HANG = '77b5c16b-56b8-46f2-b90d-9b96830624e3' // Nguyễn T.Minh Hằng
const SRC = 'rà soát LSX 15/09/2026'

const n = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
const nl = (s) =>
  String(s ?? '')
    .replace(/[ \t]+/g, ' ')
    .trim() // giữ xuống dòng
const low = (s) => n(s).toLowerCase()
const numv = (s) => {
  const t = n(s).replace(/,/g, '')
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null
}
const keyOf = (s) => low(s).replace(/[^a-z0-9]/g, '')
/** "1708430.12" → "1708430" (LAURA đánh đuôi .11/.12/.22 cho từng mã thùng). */
const baseCode = (s) => n(s).replace(/\.\d{2}$/, '')
/** "w48.26" → chủ nhật cuối tuần ISO 48 năm 2026. */
function weekToDate(label) {
  const m = /^w(\d{1,2})\.(\d{2})$/i.exec(n(label))
  if (!m) return null
  const year = 2000 + Number(m[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const week1Mon = new Date(jan4)
  week1Mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const d = new Date(week1Mon)
  d.setUTCDate(week1Mon.getUTCDate() + (Number(m[1]) - 1) * 7 + 6)
  return d.toISOString().slice(0, 10)
}
const mdy = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(n(s))
  if (!m) return null
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
  return `${y}-${String(+m[1]).padStart(2, '0')}-${String(+m[2]).padStart(2, '0')}`
}
const dmy = (s) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(n(s))
  if (!m) return null
  const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
  return `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`
}
const sheet = (file, name) => {
  const wb = XLSX.readFile(file)
  return XLSX.utils.sheet_to_json(wb.Sheets[name ?? wb.SheetNames[0]], {
    header: 1,
    raw: false,
    defval: '',
  })
}

// ── Hồ sơ SP phải mở mới ────────────────────────────────────────────────────
// Loại/vật liệu quyết theo tên Việt + tên nước ngoài trong chính file LSX.
const NEW_PRODUCTS = [
  // MERXX — mã khách dạng NNNNN-CCC, 3 số đuôi là MÀU nên -909 ≠ -209.
  { cust: 'MERXX', code: '22020-909', type: 'CH', mat: 'AL' },
  { cust: 'MERXX', code: '26304-309', type: 'CH', mat: 'AL' },
  { cust: 'MERXX', code: '26315-309', type: 'CH', mat: 'AL' },
  { cust: 'MERXX', code: '26316-309', type: 'CH', mat: 'AL' },
  { cust: 'MERXX', code: '26471-210', type: 'TB', mat: 'AL' },
  { cust: 'MERXX', code: '92800-262', type: 'AC', mat: 'XX' },
  { cust: 'MERXX', code: '92801-210', type: 'AC', mat: 'XX' },
  { cust: 'MERXX', code: '92802-262', type: 'AC', mat: 'XX' },
  { cust: 'MERXX', code: '92803-228', type: 'AC', mat: 'XX' },
  { cust: 'MERXX', code: '45230-907', type: 'CH', mat: 'AL' },
  { cust: 'JAWOLL', code: '00211558', type: 'BN', mat: 'AL' },
  { cust: 'ROSCO', code: '2723875', type: 'BN', mat: 'IR' },
  { cust: 'ROSCO', code: '490CH1', type: 'CH', mat: 'AL' },
  { cust: 'ROSCO', code: '490TC70', type: 'TB', mat: 'AL' },
  { cust: 'ROSCO', code: '490TC120', type: 'TB', mat: 'AL' },
  { cust: 'ROSCO', code: '490TC140', type: 'TB', mat: 'AL' },
  { cust: 'ROSCO', code: '490COHL', type: 'ST', mat: 'AL' },
  { cust: 'ROSCO', code: '490CB', type: 'OT', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389536K', type: 'TB', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389537K', type: 'CH', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389538K', type: 'BN', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389539K', type: 'BN', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389536N', type: 'TB', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389537N', type: 'CH', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389538N', type: 'BN', mat: 'AL' },
  { cust: 'GIGA', code: 'N767P389539N', type: 'BN', mat: 'AL' },
  { cust: 'BLACKIN', code: 'BT-HG01', type: 'TB', mat: 'IR' },
  { cust: 'BLACKIN', code: 'BT-HG02', type: 'CH', mat: 'IR' },
]

// LAURA đổi mã theo mùa; bản nạp LSX 01 đã chốt các cặp này, giữ nguyên để
// không đẻ SP trùng (một SP hai mã thùng .12/.22 vẫn là MỘT sản phẩm).
const LAURA_ALIAS = {
  1708431: '1705703', // Bàn Hali 235cm
  1708432: '1700575.11', // Ghế Hali stool màu kem
  1708433: '1700574.11', // Ghế Hali stool màu đen
  1708422: '1708412', // lỗi gõ trong file LSX 02 (đúng là 1708412.22)
}

// ── Đọc file ────────────────────────────────────────────────────────────────
/** Khuôn MERXX/JAWOLL: 1 khối, cột cố định theo nhãn tiêu đề. */
function readFlat(file, map) {
  const rows = sheet(file)
  const hi = rows.findIndex((r) => low(r[0]) === 'stt')
  const H = rows[hi].map(low)
  const col = (...ks) => {
    for (const k of ks) {
      const i = H.findIndex((h) => h.includes(k))
      if (i >= 0) return i
    }
    return -1
  }
  const c = {
    code: col('mã sp'),
    fname: col('tên tiếng'),
    vname: col('tên tiếng việt'),
    customs: col('tên khai hải quan'),
    bar: col('barcode'),
    unit: col('đvt'),
    qty: col('số lượng'),
    pack: col('đóng gói'),
    ship: col('thời gian xuất'),
    note: col('note'),
    ...map,
  }
  // cột tên tiếng nước ngoài là cột 'tên tiếng ...' ĐẦU TIÊN khác tiếng việt
  const fIdx = H.findIndex((h) => /tên tiếng (đức|anh)/.test(h))
  const out = []
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    if (/^(để đảm bảo|nơi nhận|giám đốc)/i.test(low(r[0]))) break
    if (/^tổng/i.test(n(r[0])) || /^tổng/i.test(n(r[1]))) continue
    const code = n(r[c.code])
    if (!code) continue
    out.push({
      code,
      name_foreign: nl(r[fIdx >= 0 ? fIdx : c.fname]) || null,
      name_vi: nl(r[c.vname]) || null,
      name_customs: c.customs >= 0 ? nl(r[c.customs]) || null : null,
      barcode: c.bar >= 0 ? n(r[c.bar]) || null : null,
      unit: n(r[c.unit]) || 'cái',
      qty: numv(r[c.qty]) ?? 0,
      packing: nl(r[c.pack]) || null,
      shipLabel: n(r[c.ship]) || null,
      note: c.note >= 0 ? nl(r[c.note]) || null : null,
      specs: Object.fromEntries(
        Object.entries({
          may: col('mây') >= 0 ? nl(r[col('mây')]) : nl(r[col('dây dù')]),
          nem: col('nệm') >= 0 ? nl(r[col('nệm')]) : nl(r[col('vái')]),
          son: nl(r[col('sơn')]),
          kinh: nl(r[col('kính')]),
          go: nl(r[col('gỗ')]),
        }).filter(([, v]) => v),
      ),
    })
  }
  return out
}

/** Khuôn LAURA/GIGA: nhiều khối PO#, dòng nối tiếp không có SL là mã thùng 2. */
function readBlocks(file) {
  const rows = sheet(file)
  const hi = rows.findIndex((r) => low(r[0]) === 'stt')
  const H = rows[hi].map(low)
  const col = (...ks) => {
    for (const k of ks) {
      const i = H.findIndex((h) => h.includes(k))
      if (i >= 0) return i
    }
    return -1
  }
  const fIdx = H.findIndex((h) => /tên tiếng (đức|anh)/.test(h))
  const C = {
    code: col('mã sp'),
    vname: col('tên tiếng việt'),
    customs: col('tên khai hải quan'),
    unit: col('đvt'),
    qty: col('số lượng'),
    may: col('mây'),
    nem: col('nệm'),
    son: col('sơn'),
    kinh: col('kính'),
    go: col('gỗ'),
    pack: col('đóng gói'),
    ship: col('thời gian xuất'),
    note: col('note'),
    imp: col('lưu ý quan trọng'),
  }
  const blocks = []
  let section = ''
  let cur = null
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    if (/^(để đảm bảo|nơi nhận|giám đốc)/i.test(low(r[0]))) break
    const c1 = n(r[1])
    if (/^tổng/i.test(c1)) continue
    if (c1 && !n(r[2]) && !n(r[0])) {
      if (/^PO#/i.test(c1)) {
        cur = {
          po: c1.replace(/^PO#:?\s*/i, '').trim() || null,
          raw: c1,
          section,
          lines: [],
        }
        blocks.push(cur)
      } else section = c1
      continue
    }
    const code = n(r[C.code])
    if (!code) continue
    if (!cur) {
      cur = { po: null, raw: '', section, lines: [] }
      blocks.push(cur)
    }
    const qty = numv(r[C.qty])
    if (qty == null) {
      if (cur.lines.length) cur.lines[cur.lines.length - 1].altCodes.push(code)
      continue
    }
    cur.lines.push({
      code,
      altCodes: [],
      name_foreign: nl(r[fIdx]) || null,
      name_vi: nl(r[C.vname]) || null,
      name_customs: C.customs >= 0 ? nl(r[C.customs]) || null : null,
      unit: n(r[C.unit]) || 'cái',
      qty,
      packing: nl(r[C.pack]) || null,
      shipLabel: n(r[C.ship]).replace(/\s+/g, ' ') || null,
      note: C.note >= 0 ? nl(r[C.note]) || null : null,
      important: C.imp >= 0 ? nl(r[C.imp]) || null : null,
      specs: Object.fromEntries(
        Object.entries({
          may: nl(r[C.may]),
          nem: nl(r[C.nem]),
          son: nl(r[C.son]),
          kinh: nl(r[C.kinh]),
          go: nl(r[C.go]),
        }).filter(([, v]) => v),
      ),
    })
  }
  // nhãn ngày xuất của khối = ô đầu tiên có ghi
  for (const b of blocks)
    b.shipLabel = b.lines.find((l) => l.shipLabel)?.shipLabel ?? null
  return blocks
}

/** Khuôn ROSCO ARUBA: ma trận — mỗi cột là một PI, hàng 7 ngày / hàng 8 số PI. */
function readRoscoMatrix(file) {
  const rows = sheet(file, 'Ver 2')
  const hi = rows.findIndex((r) => low(r[0]) === 'stt')
  const H = rows[hi].map(low)
  const col = (...ks) => {
    for (const k of ks) {
      const i = H.findIndex((h) => h.includes(k))
      if (i >= 0) return i
    }
    return -1
  }
  const cQtyStart = col('số lượng / ngày xuất')
  const cTotal = col('tổng số lượng')
  const dateRow = rows[hi + 1]
  const poRow = rows[hi + 2]
  const pis = []
  for (let j = cQtyStart; j < cTotal; j++) {
    const po = n(poRow[j])
    if (po) pis.push({ col: j, po, dateRaw: n(dateRow[j]) })
  }
  const C = {
    code: col('mã sp'),
    vname: col('tên sp tiếng việt'),
    fname: col('tên sp tiếng anh'),
    desc: col('mô tả sp'),
    dim: col('kích thước'),
    unit: col('đvt'),
    pack: col('đóng gói'),
    ship: col('thời gian xuất'),
    note: col('lưu ý'),
  }
  const items = []
  for (let i = hi + 3; i < rows.length; i++) {
    const r = rows[i]
    if (/^tổng/i.test(n(r[0])) || /^tổng/i.test(n(r[1]))) continue
    if (/^(ghi chú|để đảm bảo|nơi nhận|giám đốc)/i.test(low(r[1]) || low(r[0]))) break
    const code = n(r[C.code])
    if (!code) continue
    items.push({
      code,
      name_vi: nl(r[C.vname]) || null,
      name_foreign: nl(r[C.fname]) || null,
      desc: nl(r[C.desc]) || null,
      dim: nl(r[C.dim]) || null,
      unit: n(r[C.unit]) || 'cái',
      packing: nl(r[C.pack]) || null,
      note: nl(r[C.note]) || null,
      qtys: Object.fromEntries(pis.map((p) => [p.po, numv(r[p.col]) ?? 0])),
      total: numv(r[cTotal]) ?? 0,
    })
  }
  return { pis, items }
}

// ── Nạp dữ liệu nền ─────────────────────────────────────────────────────────
const db = await client(import.meta.url)
const say = []
const log = (s) => {
  say.push(s)
  console.log(s)
}

async function all(table, select, eq) {
  const out = []
  for (let f = 0; ; f += 1000) {
    let q = db
      .from(table)
      .select(select)
      .range(f, f + 999)
    if (eq) q = q.eq(eq[0], eq[1])
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const customers = await all('sales_customers', 'id, code, name, owner_id')
const products = await all(
  'technical_products',
  'id, code, code_legacy, customer_item_code, name, name_foreign, barcode, unit, packing, tech_spec, image_file_id, customer_name',
)
const orders = await all('sales_orders', 'id, code, customer_id, production_order_id')
const lsxs = await all(
  'production_orders',
  'id, code, status, customer_id, revision, ship_date',
)

const cusBy = (code) => customers.find((c) => c.code === code)
const prodIdx = new Map()
for (const p of products) {
  for (const k of [p.code, p.customer_item_code, p.code_legacy].filter(Boolean)) {
    if (!prodIdx.has(keyOf(k))) prodIdx.set(keyOf(k), p)
  }
}
/** Tra SP theo mã khách; LAURA bỏ đuôi .NN và đi qua bảng đổi mã theo mùa. */
function findProduct(code) {
  const direct = prodIdx.get(keyOf(code))
  if (direct) return direct
  const base = baseCode(code)
  const alias = LAURA_ALIAS[base]
  if (alias)
    return prodIdx.get(keyOf(alias)) ?? prodIdx.get(keyOf(baseCode(alias))) ?? null
  return prodIdx.get(keyOf(base)) ?? prodIdx.get(keyOf(base + '.11')) ?? null
}

const CODE_RE = /^([A-Z]{2})(\d{4,6})HG-([A-Z]{2})$/
const serial = {}
for (const p of products) {
  const m = CODE_RE.exec(String(p.code).toUpperCase())
  if (m) serial[m[1]] = Math.max(serial[m[1]] ?? 0, Number(m[2]))
}
const nextCode = (type, mat) => {
  serial[type] = (serial[type] ?? 0) + 1
  return `${type}${String(serial[type]).padStart(4, '0')}HG-${mat}`
}
const parsePacking = (t) => {
  const m = /^(\d+)\s*[^\d/]*\/\s*([\p{L} ]+)$/u.exec(n(t ?? ''))
  return m ? { qty: Number(m[1]), label: m[2].trim().toLowerCase() } : null
}
const usable = (v) => (v && !/xác nhận sau|thông báo sau/i.test(v) ? v : '')

// ── Đọc 5 file cần nạp + 3 file cần đối chiếu ───────────────────────────────
const F = {
  mx05: readFlat(`${TP}/MERXX/REVISED LSX 05.26.27( 18014 HG-MX).xls`),
  mx09: readFlat(`${TP}/MERXX/LSX 09.26.27( 18056 HG-MX).xls`),
  mx10: readFlat(`${TP}/MERXX/LSX 10.26.27( 18064 HG-MX).xls`),
  jawoll: readFlat(`${TP}/JAWOLL/LSX 01.26.27HG-JAWOLL.xls`),
  blackin: readFlat(`${TP}/LSX BLACKIN/LSX 01.26.27 HG-BLACKIN.xls`),
  laura02: readBlocks(`${TP}/LAURA/LSX 02.26-27 HG-LAURA.xls`),
  giga: readBlocks(`${TP}/GIGA/LSX 01.26.27 HG-GIGA STEVE'S.xls`),
  rosco03: readRoscoMatrix(`${NV}/LSX 03.26-27 HG-ROSCO - 08.09.26.xls`),
  rosco02: sheet(
    `${NV}/LSX 02.26-27 HG-ROSCO - 25.08.2026 - cập nhật 03.09.xls`,
    'Ver 2',
  ),
}
/** Gom mọi dòng file để lấy thuộc tính khi mở hồ sơ SP mới. */
const attrOf = new Map()
const remember = (l) => {
  const k = keyOf(l.code)
  if (!attrOf.has(k)) attrOf.set(k, l)
  for (const a of l.altCodes ?? []) if (!attrOf.has(keyOf(a))) attrOf.set(keyOf(a), l)
}
for (const k of ['mx05', 'mx09', 'mx10', 'jawoll', 'blackin']) F[k].forEach(remember)
for (const k of ['laura02', 'giga']) F[k].forEach((b) => b.lines.forEach(remember))
F.rosco03.items.forEach((it) =>
  remember({ ...it, packing: it.packing, specs: {}, barcode: null }),
)
{
  // ROSCO 02 "Ver 2" — lấy tên cho SP 2723875 và số lượng mới
  const rows = F.rosco02
  const hi = rows.findIndex((r) => low(r[0]) === 'stt')
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]
    const code = n(r[2])
    if (!code || /^tổng/i.test(code)) continue
    remember({
      code,
      name_vi: nl(r[3]) || null,
      name_foreign: nl(r[4]) || null,
      unit: n(r[6]) || 'cái',
      qty: numv(r[7]) ?? 0,
      packing: nl(r[9]) || null,
      note: nl(r[11]) || null,
      specs: {},
      barcode: null,
    })
  }
}

console.log(`\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — ${SRC}\n`)

// ── 1. Khách hàng ───────────────────────────────────────────────────────────
const NEW_CUSTOMERS = [
  { code: 'GIGA', name: 'GIGA', owner_id: SALE_PHUONG },
  { code: 'BLACKIN', name: 'BLACKIN', owner_id: SALE_PHUONG },
]
log('── 1. KHÁCH HÀNG ──')
for (const c of NEW_CUSTOMERS) {
  if (cusBy(c.code)) {
    log(`  = ${c.code} đã có`)
    continue
  }
  log(`  + tạo khách ${c.code} (sale: Thanh Phương)`)
  if (APPLY) {
    const { data, error } = await db
      .from('sales_customers')
      .insert({ ...c, is_active: true, lsx_template: {}, notes: `Mở theo ${SRC}.` })
      .select('id, code, name, owner_id')
      .single()
    if (error) throw new Error(`${c.code}: ${error.message}`)
    customers.push(data)
  } else customers.push({ id: `<new:${c.code}>`, ...c })
}
{
  const j = cusBy('JAWOLL')
  if (j && !j.owner_id) {
    log('  ~ JAWOLL: gán sale Thanh Phương')
    if (APPLY) {
      const { error } = await db
        .from('sales_customers')
        .update({ owner_id: SALE_PHUONG })
        .eq('id', j.id)
      if (error) throw new Error(`JAWOLL: ${error.message}`)
    }
  }
}

// ── 2. Hồ sơ SP ─────────────────────────────────────────────────────────────
log('\n── 2. HỒ SƠ SẢN PHẨM ──')
const createdProducts = new Map()
for (const spec of NEW_PRODUCTS) {
  const hit = findProduct(spec.code)
  if (hit) {
    log(`  = ${spec.code} đã có (${hit.code})`)
    continue
  }
  const a = attrOf.get(keyOf(spec.code))
  if (!a) throw new Error(`Không tìm thấy dòng file cho mã mới ${spec.code}`)
  const pk = parsePacking(a.packing)
  const hgCode = nextCode(spec.type, spec.mat)
  const techSpec = Object.fromEntries(
    Object.entries({
      machine: a.specs?.may,
      cushion: a.specs?.nem,
      paint: a.specs?.son,
      glass: a.specs?.kinh,
      wood: a.specs?.go,
    })
      .map(([k, v]) => [k, usable(v)])
      .filter(([, v]) => v),
  )
  const row = {
    code: hgCode,
    // cột `name` là 1 dòng (giới hạn 200 ký tự) — ô LSX hay xuống dòng, gộp lại
    name: n(a.name_vi || a.name_foreign || spec.code).slice(0, 200),
    name_foreign: a.name_foreign ? n(a.name_foreign).slice(0, 200) : null,
    unit: a.unit || 'cái',
    customer_name: spec.cust,
    customer_item_code: spec.code,
    barcode: a.barcode ?? null,
    product_type: spec.type,
    frame_material: spec.mat,
    packing: pk
      ? {
          qty_per_carton: pk.qty,
          ...(pk.label !== 'thùng' ? { pack_unit_label: pk.label } : {}),
        }
      : {},
    tech_spec: techSpec,
    bom_status: 'none',
    is_active: true,
    customer_id: cusBy(spec.cust)?.id ?? null,
    notes: `Mở theo ${SRC} từ file LSX. Định mức chưa có.`,
  }
  log(`  + SP ${hgCode} ← ${spec.code}  ${String(row.name).slice(0, 44)}`)
  if (APPLY) {
    const { data, error } = await db
      .from('technical_products')
      .insert(row)
      .select('id, code, customer_item_code, image_file_id')
      .single()
    if (error) throw new Error(`${hgCode}: ${error.message}`)
    createdProducts.set(keyOf(spec.code), data)
    prodIdx.set(keyOf(spec.code), data)
  } else {
    const fake = { id: `<new:${hgCode}>`, code: hgCode, customer_item_code: spec.code }
    createdProducts.set(keyOf(spec.code), fake)
    prodIdx.set(keyOf(spec.code), fake)
  }
}
// bù ô trống trên hồ sơ đã có (chỉ điền chỗ TRỐNG, không ghi đè)
let patched = 0
for (const [k, a] of attrOf) {
  const hit = prodIdx.get(k)
  if (!hit || createdProducts.has(k)) continue
  const patch = {}
  if (!n(hit.customer_item_code) && !/^[A-Z]{2}\d{4,6}HG-/.test(a.code)) {
    patch.customer_item_code = a.code
  }
  if (!n(hit.name_foreign) && a.name_foreign) patch.name_foreign = a.name_foreign
  if (!n(hit.barcode) && a.barcode) patch.barcode = a.barcode
  if (!Object.keys(patch).length) continue
  patched++
  log(`  ~ SP ${hit.code}: bù ${Object.keys(patch).join(', ')}`)
  if (APPLY) {
    const { error } = await db.from('technical_products').update(patch).eq('id', hit.id)
    if (error) throw new Error(`${hit.code}: ${error.message}`)
  }
}
log(`  → tạo ${createdProducts.size} SP, bù ${patched} hồ sơ`)
// ── 3. Năm lệnh sản xuất còn thiếu ──────────────────────────────────────────
// Mỗi lệnh: 1 bản ghi production_orders (NHÁP) + nhóm theo PO + dòng lệnh.
// Đơn hàng chỉ tạo khi file có số PO thật (ROSCO/LAURA/MERXX); GIGA + BLACKIN
// để trống vì chính file bỏ trống ô PO#.
log('\n── 3. LỆNH SẢN XUẤT MỚI ──')

const lsxBy = (code) => lsxs.find((x) => x.code === code)
const orderBy = (code) => orders.find((o) => o.code === code)

async function ensureOrder(code, custId, poNo, dueDate, saleId, note) {
  const hit = orderBy(code)
  if (hit) return hit
  log(`    + đơn ${code}`)
  if (!APPLY) {
    const fake = { id: `<new-order:${code}>`, code, customer_id: custId }
    orders.push(fake)
    return fake
  }
  const { data, error } = await db
    .from('sales_orders')
    .insert({
      code,
      customer_id: custId,
      customer_po_no: poNo,
      currency: 'USD',
      due_date: dueDate,
      created_by: saleId,
      note,
    })
    .select('id, code, customer_id, production_order_id')
    .single()
  if (error) throw new Error(`đơn ${code}: ${error.message}`)
  orders.push(data)
  return data
}

/**
 * groups: [{ title, po_no, ship_date, ship_label, orderCode, lines: [...] }]
 * line:   { code, name_foreign, name_vi, name_customs, barcode, unit, qty,
 *           packing, ship_date, ship_label, specs, note, important }
 */
async function ensureLsx(lsxCode, custCode, head, groups) {
  if (lsxBy(lsxCode)) {
    log(`  = ${lsxCode} đã có, bỏ qua`)
    return
  }
  const cust = cusBy(custCode)
  if (!cust) throw new Error(`Chưa có khách ${custCode}`)
  const nLines = groups.reduce((a, g) => a + g.lines.length, 0)
  const qty = groups.reduce((a, g) => a + g.lines.reduce((x, l) => x + l.qty, 0), 0)
  log(`  + ${lsxCode} — ${groups.length} nhóm, ${nLines} dòng, ${qty} sp`)

  let lsxId = `<new-lsx:${lsxCode}>`
  if (APPLY) {
    const now = new Date().toISOString()
    const { data, error } = await db
      .from('production_orders')
      .insert({
        code: lsxCode,
        customer_id: cust.id,
        status: 'draft',
        ship_date: head.ship_date ?? null,
        container_summary: head.container ?? null,
        created_by: head.sale,
        issued_by: head.sale,
        issued_at: now,
        note: head.note,
      })
      .select('id, code, status, customer_id, revision, ship_date')
      .single()
    if (error) throw new Error(`${lsxCode}: ${error.message}`)
    lsxId = data.id
    lsxs.push(data)
  }

  let sort = 0
  for (const [gi, g] of groups.entries()) {
    let orderId = null
    if (g.orderCode) {
      const o = await ensureOrder(
        g.orderCode,
        cust.id,
        g.po_no,
        g.ship_date,
        head.sale,
        `Nạp từ ${head.file} (${SRC}). Đơn giá chờ Kinh doanh điền.`,
      )
      orderId = o.id
      if (APPLY && !o.production_order_id) {
        const { error } = await db
          .from('sales_orders')
          .update({ production_order_id: lsxId })
          .eq('id', o.id)
        if (error) throw new Error(`nối đơn ${g.orderCode}: ${error.message}`)
        o.production_order_id = lsxId
      }
    }
    let groupId = `<new-group:${gi}>`
    if (APPLY) {
      const { data, error } = await db
        .from('production_order_groups')
        .insert({
          production_order_id: lsxId,
          sales_order_id: orderId,
          title: g.title,
          po_no: g.po_no,
          ship_date: g.ship_date ?? null,
          ship_label: g.ship_label ?? null,
          note: g.note ?? null,
          sort_order: gi,
        })
        .select('id')
        .single()
      if (error) throw new Error(`nhóm ${g.title}: ${error.message}`)
      groupId = data.id
    }
    const rows = []
    for (const l of g.lines) {
      const p = findProduct(l.code)
      if (!p) throw new Error(`${lsxCode}: chưa có hồ sơ SP cho mã ${l.code}`)
      rows.push({
        production_order_id: lsxId,
        group_id: groupId,
        product_id: p.id,
        product_code: p.code,
        customer_item_code: l.code,
        name_foreign: l.name_foreign ?? null,
        name_vi: l.name_vi ?? null,
        name_customs: l.name_customs ?? null,
        barcode: l.barcode ?? null,
        unit: l.unit ?? 'cái',
        qty: l.qty,
        packing: l.packing ?? null,
        ship_date: l.ship_date ?? g.ship_date ?? null,
        ship_label: l.ship_label ?? g.ship_label ?? null,
        specs: l.specs ?? {},
        checks: {},
        extras: l.altCodes?.length ? { ma_thung_2: l.altCodes.join(', ') } : {},
        note: l.note ?? null,
        important_note: l.important ?? null,
        image_file_id: p.image_file_id ?? null,
        sort_order: sort++,
      })
    }
    log(
      `      · ${g.title}${g.po_no ? ' [PO ' + g.po_no + ']' : ''} — ${rows.length} dòng, ` +
        `${rows.reduce((a, b) => a + b.qty, 0)} sp, xuất ${g.ship_date ?? g.ship_label ?? '?'}`,
    )
    if (APPLY) {
      const { error } = await db.from('production_order_lines').insert(rows)
      if (error) throw new Error(`dòng nhóm ${g.title}: ${error.message}`)
    }
  }
}

// 3.1 MERXX 10/26-27 — 1 khối, PO 18064, giao w48.26
{
  const ship = weekToDate('w48.26')
  await ensureLsx(
    '10/26-27 - MX',
    'MERXX',
    {
      sale: SALE_PHUONG,
      ship_date: ship,
      file: 'LSX 10.26.27 (18064 HG-MX)',
      note: `Nạp từ file LSX 10.26.27 (18064 HG-MX) — ${SRC}.`,
    },
    [
      {
        title: 'Đơn 18064 HG-MX',
        po_no: '18064',
        ship_date: ship,
        ship_label: 'w48.26',
        orderCode: '18064 HG-MX',
        lines: F.mx10.map((l) => ({
          ...l,
          ship_date: ship,
          ship_label: l.shipLabel,
        })),
      },
    ],
  )
}

// 3.2 BLACKIN 01/26-27 — 1 khối, file KHÔNG ghi số PO; ngày "11/10/27" mập mờ
{
  await ensureLsx(
    '01/26-27 - BLACKIN',
    'BLACKIN',
    {
      sale: SALE_PHUONG,
      ship_date: null,
      container: "1 x 40'HC + 1 x 40'DC",
      file: 'LSX 01.26.27 HG-BLACKIN',
      note:
        `Nạp từ file LSX 01.26.27 HG-BLACKIN — ${SRC}. ` +
        'File không ghi số PO. Ngày xuất trên file ghi "11/10/27", chưa rõ ngày/tháng nên để ở nhãn.',
    },
    [
      {
        title: 'Đợt 1',
        po_no: null,
        ship_date: null,
        ship_label: F.blackin[0]?.shipLabel ?? null,
        lines: F.blackin.map((l) => ({ ...l, ship_label: l.shipLabel })),
      },
    ],
  )
}

// 3.3 GIGA 01/26-27 — 5 đợt, ô PO# bỏ trống; ngày trong file là ngày/tháng/năm
{
  const blocks = F.giga
  const groups = blocks.map((b, i) => {
    const m = /xuất hàng:\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i.exec(b.shipLabel ?? '')
    return {
      title: `Đợt ${i + 1}`,
      po_no: null,
      ship_date: m ? dmy(m[1]) : null,
      ship_label: b.shipLabel,
      lines: b.lines.map((l) => ({ ...l, ship_label: l.shipLabel })),
    }
  })
  await ensureLsx(
    '01/26-27 - GIGA',
    'GIGA',
    {
      sale: SALE_PHUONG,
      ship_date: groups[0]?.ship_date ?? null,
      container: "5 x 40'HC",
      file: 'LSX 01.26.27 HG-GIGA STEVE (Sheet1)',
      note:
        `Nạp từ file LSX 01.26.27 HG-GIGA — ${SRC}. ` +
        'File để trống ô PO# của cả 5 đợt, Kinh doanh bổ sung sau.',
    },
    groups,
  )
}

// 3.4 LAURA 02/26-27 — 6 PO; ngày trong file là tháng/ngày/năm
{
  // Ô PO của LAURA đôi khi kèm câu chú ("PO#31032193244 (PO này cập nhập số
  // này - hủy số của PO này ở LSX 01)") — số PO chỉ là cụm đầu, phần còn lại
  // là ghi chú của nhóm, không được chui vào `po_no` lẫn mã đơn hàng.
  const groups = F.laura02.map((b) => {
    const poNo = (/^[0-9A-Za-z._/-]+/.exec(b.po ?? '') ?? [null])[0]
    const extra = n(String(b.po ?? '').slice(poNo?.length ?? 0)).replace(
      /^[()\s-]+|[()\s]+$/g,
      '',
    )
    return {
      title: b.section ? `${b.section} — PO#${poNo}` : `PO#${poNo}`,
      po_no: poNo,
      ship_date: mdy(b.shipLabel),
      ship_label: b.shipLabel,
      orderCode: poNo,
      note: extra || null,
      lines: b.lines.map((l) => ({ ...l, ship_date: mdy(l.shipLabel) })),
    }
  })
  await ensureLsx(
    '02/26-27 - LAURA',
    'LAURA',
    {
      sale: SALE_PHUONG,
      ship_date: null,
      file: 'LSX 02.26-27 HG-LAURA',
      note:
        `Nạp từ file LSX 02.26-27 HG-LAURA — ${SRC}. ` +
        'PO#31032193244 dùng lại số của LSX 01 (file ghi: huỷ số ở LSX 01).',
    },
    groups,
  )
}

// 3.5 ROSCO 03/26-27 (ARUBA 159) — ma trận 4 PI; ngày mập mờ nên chỉ giữ nhãn
{
  const { pis, items } = F.rosco03
  const groups = pis.map((p) => ({
    title: `PI ${p.po}`,
    po_no: p.po,
    ship_date: null,
    ship_label: p.dateRaw,
    orderCode: p.po,
    lines: items
      .filter((it) => it.qtys[p.po] > 0)
      .map((it) => ({
        code: it.code,
        name_vi: it.name_vi,
        name_foreign: it.name_foreign,
        name_customs: null,
        barcode: null,
        unit: it.unit,
        qty: it.qtys[p.po],
        packing: it.packing,
        ship_label: p.dateRaw,
        specs: {},
        note:
          [it.desc, it.dim && `Kích thước: ${it.dim}`].filter(Boolean).join('\n') || null,
        important: it.note,
      })),
  }))
  await ensureLsx(
    '03/26-27 - ROSCO',
    'ROSCO',
    {
      sale: SALE_HANG,
      ship_date: null,
      file: 'LSX 03.26-27 HG-ROSCO - 08.09.26',
      note:
        `Nạp từ file LSX 03.26-27 HG-ROSCO (ARUBA 159) ngày 08/09/2026 — ${SRC}. ` +
        'Ngày xuất trên file (10/11/2026, 10/12/2026, 5/1/2027) chưa rõ ngày/tháng nên để ở nhãn.',
    },
    groups,
  )
}
// ── 4. Nối hồ sơ SP cho dòng lệnh cũ đang bỏ trống + bù ô trống trên dòng ────
// Chỉ đụng vào dòng KHÔNG có `production_components` treo bên dưới (đã kiểm:
// cả 13 dòng dưới đây đều 0), nên nối thêm không phá kế hoạch chi tiết nào.
log('\n── 4. NỐI SP CHO DÒNG LỆNH CŨ ──')

const FILE_OF_LSX = {
  '05/26-27 - MX': F.mx05,
  '09/26-27 - MX': F.mx09,
  '01/26-27 - JAWOLL': F.jawoll,
}
let linked = 0
let filled = 0
for (const [lsxCode, rows] of Object.entries(FILE_OF_LSX)) {
  const lsx = lsxs.find((x) => x.code === lsxCode)
  if (!lsx || String(lsx.id).startsWith('<')) continue
  const { data: lines, error } = await db
    .from('production_order_lines')
    .select(
      'id, product_id, product_code, customer_item_code, barcode, packing, ship_date, ship_label, specs, name_foreign, name_customs',
    )
    .eq('production_order_id', lsx.id)
    .order('sort_order')
  if (error) throw new Error(`${lsxCode}: ${error.message}`)
  const fileBy = new Map(rows.map((r) => [keyOf(r.code), r]))
  for (const l of lines) {
    const custCode = n(l.customer_item_code) || n(l.product_code)
    const f = fileBy.get(keyOf(custCode))
    const patch = {}
    if (!l.product_id) {
      const p = findProduct(custCode)
      if (p && !String(p.id).startsWith('<')) {
        patch.product_id = p.id
        patch.product_code = p.code
        patch.customer_item_code = custCode
        linked++
      } else if (p) {
        // dry-run: SP sẽ được tạo ở bước 2
        log(`    · ${lsxCode} ${custCode} → ${p.code} (sẽ nối khi --apply)`)
        linked++
      }
    }
    if (f) {
      if (!n(l.barcode) && f.barcode) patch.barcode = f.barcode
      if (!n(l.packing) && f.packing) patch.packing = f.packing
      if (!n(l.name_foreign) && f.name_foreign) patch.name_foreign = f.name_foreign
      if (!n(l.name_customs) && f.name_customs) patch.name_customs = f.name_customs
      if (!l.ship_date && !n(l.ship_label) && f.shipLabel) {
        patch.ship_label = f.shipLabel
        const d = weekToDate(f.shipLabel) ?? mdy(f.shipLabel)
        if (d) patch.ship_date = d
      }
      const cur = l.specs ?? {}
      if (!Object.values(cur).some((v) => n(v)) && Object.keys(f.specs ?? {}).length) {
        patch.specs = f.specs
      }
    }
    if (!Object.keys(patch).length) continue
    if (patch.barcode || patch.packing || patch.specs || patch.ship_label) filled++
    log(`    ~ ${lsxCode} ${custCode}: ${Object.keys(patch).join(', ')}`)
    if (APPLY) {
      const e = (await db.from('production_order_lines').update(patch).eq('id', l.id))
        .error
      if (e) throw new Error(`${lsxCode} ${custCode}: ${e.message}`)
    }
  }
}
// ROSCO 02 — dòng 2723875 chưa nối (SP vừa mở ở bước 2)
{
  const lsx = lsxs.find((x) => x.code === '02/26-27 - ROSCO')
  if (lsx && !String(lsx.id).startsWith('<')) {
    const { data: lines } = await db
      .from('production_order_lines')
      .select('id, product_id, product_code')
      .eq('production_order_id', lsx.id)
      .is('product_id', null)
    for (const l of lines ?? []) {
      const p = findProduct(l.product_code)
      if (!p) continue
      linked++
      log(`    ~ 02/26-27 - ROSCO ${l.product_code} → ${p.code}`)
      if (APPLY && !String(p.id).startsWith('<')) {
        const e = (
          await db
            .from('production_order_lines')
            .update({
              product_id: p.id,
              product_code: p.code,
              customer_item_code: l.product_code,
            })
            .eq('id', l.id)
        ).error
        if (e) throw new Error(`ROSCO 02 ${l.product_code}: ${e.message}`)
      }
    }
  }
}
log(`  → nối ${linked} dòng, bù ô trống ${filled} dòng`)

// ── 5. Bù số PO + đơn hàng cho nhóm của MERXX 05/07/08/09 ───────────────────
// Số PO nằm ngay trên TÊN FILE ("LSX 07.26.27( 18028 HG-MX)") nhưng lượt nạp
// trước bỏ trống. Có số PO thì Cung ứng mới lần được từ lệnh về đơn của khách.
log('\n── 5. BÙ SỐ PO CHO NHÓM ──')
const PO_FIX = {
  '05/26-27 - MX': '18014',
  '07/26-27 - MX': '18028',
  '08/26-27 - MX': '18035',
  '09/26-27 - MX': '18056',
}
for (const [lsxCode, poNo] of Object.entries(PO_FIX)) {
  const lsx = lsxs.find((x) => x.code === lsxCode)
  if (!lsx || String(lsx.id).startsWith('<')) continue
  const { data: gs, error } = await db
    .from('production_order_groups')
    .select('id, title, po_no, sales_order_id')
    .eq('production_order_id', lsx.id)
    .order('sort_order')
  if (error) throw new Error(`${lsxCode}: ${error.message}`)
  if (gs.length !== 1) {
    log(`  ! ${lsxCode} có ${gs.length} nhóm — bỏ qua, không đoán được nhóm nào`)
    continue
  }
  const g = gs[0]
  const patch = {}
  if (!n(g.po_no)) patch.po_no = poNo
  if (!g.sales_order_id) {
    const o = await ensureOrder(
      `${poNo} HG-MX`,
      lsx.customer_id,
      poNo,
      lsx.ship_date ?? null,
      SALE_PHUONG,
      `Bù theo tên file LSX ${lsxCode} (${SRC}). Đơn giá chờ Kinh doanh điền.`,
    )
    patch.sales_order_id = o.id
    if (APPLY && !o.production_order_id) {
      const e = (
        await db
          .from('sales_orders')
          .update({ production_order_id: lsx.id })
          .eq('id', o.id)
      ).error
      if (e) throw new Error(`nối đơn ${o.code}: ${e.message}`)
      o.production_order_id = lsx.id
    }
  }
  if (!Object.keys(patch).length) {
    log(`  = ${lsxCode} đã đủ`)
    continue
  }
  log(`  ~ ${lsxCode} nhóm "${g.title}": ${Object.keys(patch).join(', ')} (PO ${poNo})`)
  if (APPLY) {
    const e = (await db.from('production_order_groups').update(patch).eq('id', g.id))
      .error
    if (e) throw new Error(`${lsxCode}: ${e.message}`)
  }
}

// ── 6. ROSCO 02 lên bản "Ver 2" (sửa ngày 03/09/2026) ───────────────────────
// Hệ thống đang khớp sheet "ver 1". Sheet "Ver 2" nâng cả 6 dòng, +610 sp.
// Chỉ TĂNG số lượng, không xoá dòng nào nên không đụng dữ liệu bên dưới.
log('\n── 6. ROSCO 02 → BẢN VER 2 (03/09/2026) ──')
{
  const lsx = lsxs.find((x) => x.code === '02/26-27 - ROSCO')
  const rows = F.rosco02
  const hi = rows.findIndex((r) => low(r[0]) === 'stt')
  const want = new Map()
  for (let i = hi + 1; i < rows.length; i++) {
    const code = n(rows[i][2])
    const q = numv(rows[i][7])
    if (code && q != null && !/^tổng/i.test(code)) want.set(keyOf(code), { code, qty: q })
  }
  if (!lsx || String(lsx.id).startsWith('<')) {
    log('  ! chưa có lệnh 02/26-27 - ROSCO, bỏ qua')
  } else {
    const { data: lines, error } = await db
      .from('production_order_lines')
      .select('id, product_code, customer_item_code, qty')
      .eq('production_order_id', lsx.id)
      .order('sort_order')
    if (error) throw new Error(`ROSCO 02: ${error.message}`)
    let changed = 0
    let delta = 0
    for (const l of lines) {
      const w = want.get(keyOf(n(l.customer_item_code) || n(l.product_code)))
      if (!w || Number(l.qty) === w.qty) continue
      changed++
      delta += w.qty - Number(l.qty)
      log(`  ~ ${w.code}: ${Number(l.qty)} → ${w.qty}`)
      if (APPLY) {
        const e = (
          await db.from('production_order_lines').update({ qty: w.qty }).eq('id', l.id)
        ).error
        if (e) throw new Error(`ROSCO 02 ${w.code}: ${e.message}`)
      }
    }
    if (changed) {
      log(
        `  → ${changed} dòng, tổng +${delta} sp; revision ${lsx.revision} → ${lsx.revision + 1}`,
      )
      if (APPLY) {
        const e = (
          await db
            .from('production_orders')
            .update({
              revision: lsx.revision + 1,
              revised_at: new Date().toISOString(),
              revised_by: SALE_HANG,
              revision_note:
                'Cập nhật theo sheet "Ver 2" của file LSX 02.26-27 HG-ROSCO, khách chỉnh số lượng ngày 03/09/2026.',
            })
            .eq('id', lsx.id)
        ).error
        if (e) throw new Error(`ROSCO 02 revision: ${e.message}`)
      }
    } else log('  = đã khớp Ver 2')
  }
}

// ── Kết ─────────────────────────────────────────────────────────────────────
console.log(`
ĐÃ CHỐT VÀ ĐÃ LÀM BẰNG TAY sau lượt chạy này (15/09/2026):

  1. MERXX 06/26-27 đã hạ xuống bản REVISED — bỏ 4 dòng, còn 22 dòng / 4.770 sp,
     revision lên 2. Sao lưu ở backup-mx06-lines-20260915.json.
  2. MERXX 03/26-27 đổi số PO 17994 → 17996, đơn hàng đổi mã theo.
  3. Ngày xuất đọc theo ngày/tháng/năm: BLACKIN 01 → 11/10/2027; ROSCO 03 →
     10/11/2026, 10/12/2026, 05/01/2027, 05/01/2027.

CÒN LẠI — CẦN NGƯỜI QUYẾT:

  1. MERXX 03/26-27: dòng 150 cái vẫn trỏ SP CH0114HG-AL (mã khách 22020-209,
     barcode 4033662220208) trong khi file ghi 22020-909 (barcode 4033662976037).
     Hai mã vạch khác nhau nên là hai mặt hàng. SP 22020-909 đã mở ở bước 2 và
     đã nối cho LSX 05, nhưng chưa có định mức — đổi bây giờ thì 36 dòng
     production_components của dòng này treo. Chờ Kỹ thuật nhập định mức.

  2. LAURA 01/26-27: file chia 16 PO, hệ thống gom 3 nhóm và bỏ trống po_no.
     Thứ tự dòng trong file khác thứ tự đã nạp nên không ghép 1:1 an toàn.

  3. Số PO còn trống ở nơi CHÍNH FILE bỏ trống: GIGA 01 (5 đợt), BLACKIN 01,
     JAWOLL 01, ROSCO 02. Kinh doanh bổ sung khi khách gửi số.

  4. Định mức: 97 trên 147 SP đang dùng trong lệnh chưa có. Chưa có định mức thì
     chưa tính được nhu cầu vật tư, tức chưa chạy được mua hàng theo lệnh.
`)
if (!APPLY) console.log('Chạy lại với --apply để ghi.\n')
else console.log('✓ Đã ghi. Năm lệnh mới đang ở NHÁP — Sales soát rồi bấm Gửi duyệt.\n')
