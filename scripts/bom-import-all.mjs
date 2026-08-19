// NẠP ĐỊNH MỨC TỪ TOÀN BỘ KHO FILE BOM ("All BOM_Thức", 187 file) vào
// technical_product_parts của ĐÚNG hồ sơ sản phẩm.
//
//   node scripts/bom-import-all.mjs            # dò khô, chỉ in báo cáo
//   node scripts/bom-import-all.mjs --apply    # ghi thật
//   node scripts/bom-import-all.mjs --file "BOM_MERXX Bồn hoa lớn"   # lọc 1 file
//
// Nguồn phân nhóm và cấu trúc khối: docs/dinh-muc-nhom-theo-bom-187-file.md
// (quét đủ 187 file, 12 nhóm, 6.413 dòng, 0 tiêu đề chưa xếp).
//
// AN TOÀN — ba mức chặn, vì đây là ghi hàng loạt vào DB thật:
//   1. Mặc định là DÒ KHÔ. Phải có --apply mới ghi.
//   2. CHỈ nạp cho SP đang có 0 dòng định mức — không đè bảng ai đã nhập tay.
//   3. Không tự tạo sản phẩm mới. File không khớp SP nào thì báo cáo, để người
//      quyết định khai hồ sơ trước.
//
// Khớp sản phẩm theo thứ tự chắc → mờ: mã HG trong ô "Mã Số HG" → mã khách
// trong ô "MÃ K.HÀNG" → mã nằm trong TÊN FILE → tên SP trùng khít.

import { readdirSync, writeFileSync } from 'node:fs'
import fs2 from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { client } from './products-lib.mjs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const DIR = 'E:/All BOM_Thức'
const SCRATCH =
  'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/898a80db-19d7-4257-bd66-16d2d0ebc235/scratchpad'
const APPLY = process.argv.includes('--apply')
const CREATE = process.argv.includes('--create-missing')
const IMAGES = process.argv.includes('--images')
const ATTACH = process.argv.includes('--attach-file')
const noName = []
const only = (() => {
  const i = process.argv.indexOf('--file')
  return i >= 0 ? process.argv[i + 1] : null
})()

const s = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim())
const nodau = (v) =>
  s(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
const num = (v) => {
  if (v == null || v === '') return null
  const n =
    typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/* ── Tiêu đề khối → nhóm hạng mục (luật của coverage pass 3) ─────────────── */
function groupOf(title) {
  const t = nodau(title)
  if (/^bang dinh muc|^bang ke/.test(t)) return null
  if (/^tong( cong)?$|^tong hop|^cong$/.test(t)) return null
  if (/^ktbb|^kt sp|^option/.test(t)) return null
  if (/^[a-z]*-?[a-z]?\d+[a-z]* ?\/ ?[\d.,]+$/.test(t)) return null
  if (/polywood|van ep/.test(t)) return 'POLYWOOD'
  if (/^quy cach *:? *go|^quy cach go|^go /.test(t)) return 'WOOD'
  // VẢI xét TRƯỚC NỆM. Quét 246 file: khối đề "Quy cách Nệm:" thì 64% thật ra là
  // bảng VẢI (LOẠI VẢI · M2 · TỔNG VẢI M2 · hao hụt), chỉ 30% là bảng quy cách
  // nệm. Xét nệm trước thì tiêu đề "Quy cách Nệm + vải:" nuốt luôn phần vải vào
  // nhóm nệm — hai bảng không chung cột nào ngoài kích thước, trộn là mất số.
  if (/vai|textilen/.test(t)) return 'FABRIC'
  if (/nem|goi\b|mousse|mouse|^mous|gon /.test(t)) return 'CUSHION'
  if (/kinh|mat da|mat ban|mat nhom/.test(t)) return 'PANEL'
  if (/ngu kim/.test(t)) return 'NGU_KIM'
  if (/bao bi|dong goi/.test(t)) return 'PACKAGING'
  if (/^tem$|^tem /.test(t)) return 'LABEL'
  if (/day keo|ykk|nham gai/.test(t)) return 'ZIPPER'
  if (/^son|hoa chat|nhom\s*\+\s*son/.test(t)) return 'SON_HC'
  if (/^may$|day dan|day du/.test(t)) return 'DAY_DAN'
  if (/^quy cach *:/.test(t)) return 'FRAME'
  if (/^quy cach *(nhom|sat|inox|la sat|thep)/.test(t)) return 'FRAME'
  if (/^vat tu$/.test(t)) return 'NGU_KIM'
  return null
}

/* ── Chữ tiêu đề cột → trường (cùng luật với src/lib/bom-paste.ts) ───────── */
const HEADER_RULES = [
  [/^(stt|tt|so tt)$/, 'part_no'],
  [/parts|bo phan|^cum/, 'cluster_name'],
  [/ten chi tiet|ten hang|ten vat tu|^ten$/, 'part_name'],
  [/^loai$|kieu|dang/, 'profile_shape'],
  [/tong chieu dai|tong dai/, 'skip'],
  [/dien tich|^dt/, 'skip'],
  [/thanh tien|^tt$|don gia|^dgia$/, 'skip'],
  // BẪY ĐÃ CẮN MỘT LẦN (đo 19/08/2026): biểu mẫu GỖ đặt tên cột là
  // "K. Lượng (m3)" — luật `k. ?luong` bên dưới bắt trúng và ném m³ vào ô kg.
  // Layout `wood` KHÔNG có cột kg nên 232 con số nằm đó vô hình, còn cột
  // "K. Lượng (m³)" thì trống. Đơn vị trong ngoặc phải được đọc TRƯỚC tên cột.
  // App tự tính m³ từ hình học nên bỏ qua là đủ, không cần ghi lại.
  [/\(m ?3\)|\(m³\)|m3\b/, 'skip'],
  [/trong luong|^kl|k\. ?luong|khoi luong/, 'weight_kg'],
  [/day vat lieu|^d$|^δ$/, 'wall_thickness_mm'],
  [/phi hao|hao chi tiet|^hao$/, 'bend_waste_mm'],
  [/^mong$|mong \(/, 'tenon_mm'],
  [/^day/, 'dim_a_mm'],
  [/^rong/, 'dim_b_mm'],
  [/^dai/, 'cut_length_mm'],
  [/^cao/, 'skip'],
  [/so luong|^sl/, 'qty'],
  [/^dvt$|don vi tinh|^dv$/, 'unit'],
  [/vat lieu|chat lieu/, 'material_note'],
  [/ghi chu|^note$/, 'note'],
]
const fieldOf = (label) => {
  const t = nodau(label)
  if (!t) return null
  for (const [re, f] of HEADER_RULES) if (re.test(t)) return f
  return null
}

const SHAPES = {
  hop: 'HOP',
  tron: 'TRON',
  'tron dac': 'TRONDAC',
  vuong: 'VUONG',
  la: 'LA',
  ovan: 'OVAN',
  tam: 'TAM',
  tole: 'TAM',
  luoi: 'LUOI',
  v: 'V',
  c: 'C',
  l: 'L',
}
/** Ô "Loại" có thể là hình dạng (Hộp/Tròn) HOẶC mã khuôn (TD-HG04). */
function shapeOrDie(raw) {
  const t = nodau(raw)
  if (!t) return { shape: null, die: null }
  if (SHAPES[t]) return { shape: SHAPES[t], die: null }
  if (/^[a-zØø\u00d8]?[\d.]+$/.test(t)) return { shape: 'TRON', die: null } // "Φ25", "p6"
  return { shape: null, die: s(raw) }
}

/* ── Ảnh nhúng trong file ────────────────────────────────────────────────────
 * File BOM có 2 ảnh: LOGO công ty (neo ở dòng 1–4, descr "logo HG moi") và ẢNH
 * SẢN PHẨM (neo trong ô "Hình ảnh" phía dưới). Bỏ ảnh logo, lấy ảnh còn lại to
 * nhất. Sheet nào có bản vẽ riêng thì lấy đúng ảnh của sheet đó — file MERXX
 * tổng 90 sheet mỗi sheet một SP khác nhau.
 */
function imagesOf(wb, sheetIndex) {
  const files = wb.files ?? {}
  const text = (k) => (files[k] ? Buffer.from(files[k].content).toString('utf8') : null)
  const rels = text(`xl/worksheets/_rels/sheet${sheetIndex + 1}.xml.rels`)
  if (!rels) return []
  const drawing = rels.match(/drawings\/(drawing\d+\.xml)/)?.[1]
  if (!drawing) return []
  const dXml = text(`xl/drawings/${drawing}`)
  const dRels = text(`xl/drawings/_rels/${drawing}.rels`)
  if (!dXml || !dRels) return []

  const relTarget = new Map()
  for (const m of dRels.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    relTarget.set(m[1], m[2].replace(/^\.\.\//, 'xl/'))
  }
  const out = []
  // Mỗi <xdr:*Anchor> là một ảnh: lấy dòng neo + tên + rId trong khối đó.
  for (const block of dXml.split(/<xdr:(?=oneCellAnchor|twoCellAnchor|absoluteAnchor)/)) {
    const rid = block.match(/r:embed="([^"]+)"/)?.[1]
    if (!rid) continue
    const target = relTarget.get(rid)
    if (!target || !files[target]) continue
    const descr = `${block.match(/name="([^"]*)"/)?.[1] ?? ''} ${block.match(/descr="([^"]*)"/)?.[1] ?? ''}`
    if (/logo/i.test(descr)) continue
    const row = Number(block.match(/<xdr:row>(\d+)<\/xdr:row>/)?.[1] ?? 0)
    if (row < 4) continue // vùng tiêu đề tờ = logo/khung tên
    out.push({ path: target, bytes: files[target].size ?? 0, row })
  }
  return out.sort((a, b) => b.bytes - a.bytes)
}

/* ── Đọc một file ────────────────────────────────────────────────────────── */
function readSheet(grid) {
  // Đầu tờ: TÊN SP · Mã Số HG · MÃ K.HÀNG nằm ở ô CÁCH NHÃN 2 Ô.
  const meta = {}
  for (const row of grid.slice(0, 20)) {
    if (!row) continue
    for (let i = 0; i < row.length; i++) {
      const t = nodau(row[i])
      const val = s(row[i + 2]) || s(row[i + 1])
      if (/^ten sp:?$/.test(t)) meta.name = val
      else if (/^ma so hg:?$/.test(t)) meta.hg = val
      else if (/^ma k\.? ?hang:?$/.test(t)) meta.cust = val
      else if (/^k\.? ?hang:?$/.test(t)) meta.customer = val
      else if (/^nhien lieu:?$/.test(t)) meta.fuel = val
      else if (/^ktsp:?$/.test(t)) meta.dims = val
    }
  }

  // Các khối
  const marks = []
  grid.forEach((row, i) => {
    if (!row) return
    const filled = row.map(s).filter(Boolean)
    if (filled.length === 0 || filled.length > 2) return
    const t = filled[0]
    if (t.length < 3 || t.length > 90) return
    const isUpper = t === t.toUpperCase() && /[A-ZĐÂĂÊÔƠƯ]/.test(t)
    if (!/^quy cach/.test(nodau(t)) && !isUpper) return
    marks.push({ i, title: t })
  })

  const parts = []
  marks.forEach((m, k) => {
    const group = groupOf(m.title)
    if (!group) return
    const end = k + 1 < marks.length ? marks[k + 1].i : grid.length

    // Bản đồ cột: gộp các dòng tiêu đề liên tiếp (biểu mẫu gộp ô 2 tầng).
    const map = new Map()
    let bodyFrom = m.i + 1
    for (let r = m.i + 1; r < Math.min(m.i + 4, end); r++) {
      const row = grid[r] ?? []
      let hit = 0
      row.forEach((cell, c) => {
        const f = fieldOf(cell)
        if (f) {
          map.set(c, f)
          hit++
        }
      })
      if (hit >= 2) bodyFrom = r + 1
    }
    if (map.size === 0) return

    let lastCluster = null
    const hasClusterCol = [...map.values()].includes('cluster_name')
    const clusterSeen = new Map()
    const block = []
    for (let r = bodyFrom; r < end; r++) {
      const row = grid[r]
      if (!row || !row.some((c) => s(c))) continue
      const rec = {}
      for (const [c, f] of map) {
        if (f === 'skip') continue
        rec[f] = row[c]
      }
      const name = s(rec.part_name)
      if (!name || /^t(ổ|o)ng/i.test(name)) continue
      const qty = num(rec.qty)
      if (qty == null || qty <= 0) continue

      const { shape, die } = shapeOrDie(rec.profile_shape)
      const cluster = s(rec.cluster_name) || null
      if (cluster) clusterSeen.set(cluster, (clusterSeen.get(cluster) ?? 0) + 1)
      block.push({
        group_code: group,
        section_title: m.title,
        cluster_raw: cluster,
        // STT phải là số nguyên nhỏ. Nhiều tờ cột đầu là ô công thức (ngày
        // tháng, thành tiền) nên lọt số kiểu 39584.6 → cột int nhận là vỡ.
        part_no: (() => {
          const v = num(rec.part_no)
          return v != null && Number.isInteger(v) && v > 0 && v < 10000 ? v : null
        })(),
        part_name: name,
        profile_shape: shape,
        profile_code: die,
        dim_a_mm: num(rec.dim_a_mm),
        dim_b_mm: num(rec.dim_b_mm),
        wall_thickness_mm: num(rec.wall_thickness_mm),
        cut_length_mm: num(rec.cut_length_mm),
        bend_waste_mm: num(rec.bend_waste_mm),
        tenon_mm: num(rec.tenon_mm),
        qty,
        unit: s(rec.unit) || null,
        material_note: s(rec.material_note) || null,
        weight_kg: num(rec.weight_kg),
        note: s(rec.note) || null,
      })
    }
    // Ô cụm gộp trong Excel: tên nào cũng xuất hiện đúng 1 lần → kéo xuống.
    if (hasClusterCol && [...clusterSeen.values()].every((n) => n === 1)) {
      for (const p of block) {
        if (p.cluster_raw) lastCluster = p.cluster_raw
        else p.cluster_raw = lastCluster
      }
    }
    parts.push(...block)
  })
  return { meta, parts }
}

/* ── Khai hồ sơ mới từ tờ BOM ─────────────────────────────────────────────
 * Mã theo đúng quy tắc `src/lib/product-code.ts`: [LOẠI][4 số]HG-[VẬT LIỆU],
 * số đếm RIÊNG theo từng loại. Loại và vật liệu suy từ chính tờ BOM chứ không
 * mặc định bừa — đoán sai thì mã mang nghĩa sai vĩnh viễn.
 */
const TYPE_RULES = [
  [/gtn|giuong tam nang|sunlounger|sun lounger|daybed|chaise/, 'SL'],
  [/^bo |bo | set$|^set|sofa set|garden set/, 'ST'],
  [/bank|bench|băng|sofa|loveseat|love seat|corner/, 'BN'],
  [/ghe|chair|stool|don\b/, 'CH'],
  [/ban|table/, 'TB'],
  [/bon hoa|planter|box|tu |ke |trainer|prop/, 'OT'],
]
const typeOf = (name) => {
  const t = nodau(name)
  for (const [re, code] of TYPE_RULES) if (re.test(t)) return code
  return 'OT'
}
const MAT_RULES = [
  [/inox|stainless/, 'IN'],
  [/nhom|alu/, 'AL'],
  [/sat|thep|iron|steel/, 'IR'],
  [/go|wood|teak|acacia/, 'WD'],
  [/may|rattan|wicker/, 'RA'],
  [/kinh|glass/, 'GL'],
]
/**
 * Vật liệu khung: ô "Nhiên Liệu" của tờ trước, không có thì đọc từ chính các
 * dòng KHUNG (tên chi tiết / cột Vật liệu / tiêu đề khối) rồi mới tới tên file.
 * Để 'XX' là mã mang nghĩa "chưa xác định" đi theo SP vĩnh viễn — tránh tối đa.
 */
const matOf = (fuel, name, parts = [], fileName = '') => {
  const frame = parts
    .filter((p) => p.group_code === 'FRAME')
    .map((p) => `${p.section_title} ${p.material_note ?? ''} ${p.part_name}`)
    .join(' ')
  const t = `${nodau(fuel)} ${nodau(name)} ${nodau(frame)} ${nodau(fileName)}`
  for (const [re, code] of MAT_RULES) if (re.test(t)) return code
  return 'XX'
}
/** Khách: ô "K.HÀNG" của tờ, không có thì đoán từ tên file (BOM_ROSCO_…). */
const CUSTOMERS = [
  'MERXX',
  'ROSCO',
  'LAURA',
  'YOTRIO',
  'LYPRODAN',
  'BUNNING',
  'GIGA',
  'INTCOO',
  'CORRIDOR',
  'GUESTROOM',
  'BONLAY',
  'BLACKIN',
  'TRIWIN',
  'LANDCAMPING',
  'SHELTER HOME',
  'PHIPPSGLOBAL',
  'WESTIN',
  'DIRECT SOURCE',
]
/**
 * TÊN FILE THẮNG ô "K.HÀNG" của tờ. Nhiều tờ được copy từ mẫu của khách khác mà
 * quên sửa ô đó — `BOM_ROSCO_12.xlsx` vẫn ghi K.HÀNG "MERXX". Tên file do người
 * đặt lúc lưu nên bám khách thật hơn.
 */
const customerOf = (meta, fileName) => {
  const f = nodau(fileName)
  for (const c of CUSTOMERS) if (f.includes(nodau(c))) return c
  return s(meta.customer) || null
}

/**
 * Tên SP sạch: bỏ mã cũ dính đuôi ("Ghế 5pos Naxos 22025-309" → "Ghế 5pos
 * Naxos"). Tờ nào ô TÊN SP chỉ là một con số ("12", "5" — file ROSCO đặt tên
 * theo số thứ tự) thì tên đó vô nghĩa, lấy tên file làm tên SP.
 */
function cleanName(meta, fileName, sheetName) {
  const strip = (t) =>
    s(t)
      .replace(/\b\d{5}\s*-\s*\d{2,3}\b/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
  for (const raw of [meta?.name, sheetName]) {
    const t = strip(raw)
    if (t && t.length >= 3 && !/^\d+$/.test(t) && !/^bom$/i.test(t)) return t
  }
  // Tên file: bỏ tiền tố BOM/BKQC, tên khách, ngày tháng, đuôi file.
  let t = fileName.replace(/\.xlsx?$/i, '')
  t = t.replace(/^(bom|bkqc)\s*[-_ ]*/i, '')
  for (const c of CUSTOMERS) t = t.replace(new RegExp(`^${c}\\s*[-_ ]*`, 'i'), '')
  t = t
    .replace(/\b\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}\b/g, '')
    .replace(/\bcopy\b/gi, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  return strip(t) || null
}

/* ── Sản phẩm trong hệ ───────────────────────────────────────────────────── */
const db = await client(import.meta.url)
const products = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('technical_products')
    .select('id, code, code_legacy, customer_item_code, name, customer_name')
    .order('code')
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  products.push(...data)
  if (data.length < 1000) break
}
// PHẢI phân trang: supabase-js chặn 1.000 dòng mỗi lượt bất kể `.limit()`, nên
// lấy thiếu là tưởng SP chưa có định mức rồi NẠP CHỒNG lên bảng đã có.
const already = new Set()
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('technical_product_parts')
    .select('product_id')
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  for (const r of data) already.add(r.product_id)
  if (data.length < 1000) break
}

const byKey = new Map()
const put = (k, p) => {
  const key = nodau(k)
  if (!key) return
  if (!byKey.has(key)) byKey.set(key, p)
}
for (const p of products) {
  put(p.code, p)
  put(p.code_legacy, p)
  put(p.customer_item_code, p)
}
const byName = new Map(products.map((p) => [nodau(p.name), p]))
const nameCount = new Map()
for (const p of products)
  nameCount.set(nodau(p.name), (nameCount.get(nodau(p.name)) ?? 0) + 1)

/** Mã SP nằm lẫn trong chuỗi: "Ghế 5pos Tilos 21600-217", "…C0097HG-IR…". */
function codesIn(text) {
  const t = s(text)
  return [
    ...(t.match(/\b\d{5}\s*-\s*\d{2,3}\b/g) ?? []),
    ...(t.match(/\b[A-Z]{1,2}\d{3,4}HG-[A-Z]{2}\b/gi) ?? []),
  ].map((x) => x.replace(/\s+/g, ''))
}

function matchProduct(meta, fileName, sheetName) {
  for (const t of [meta.hg, meta.cust]) {
    const hit = byKey.get(nodau(t))
    if (hit) return { p: hit, how: 'mã trong tờ' }
  }
  // File tổng (MERXX 90 sheet) ghi mã Ở TÊN SHEET chứ không ở ô đầu tờ.
  for (const c of codesIn(sheetName)) {
    const hit = byKey.get(nodau(c))
    if (hit) return { p: hit, how: 'mã ở tên sheet' }
  }
  for (const c of codesIn(fileName)) {
    const hit = byKey.get(nodau(c))
    if (hit) return { p: hit, how: 'mã ở tên file' }
  }
  // Khớp bằng TÊN là mức mờ nhất — kho file đầy tên chung ("Table", "Bàn",
  // "Đôn", "Ghế 1", "Coffee Table"), chỉ trùng tên là gán bừa cho SP khách khác.
  // Nhận khi: tên khách của hồ sơ có trong tên file (chắc nhất), HOẶC tên vừa
  // DUY NHẤT trong thư viện vừa đủ đặc trưng (≥3 từ). Còn lại đẩy sang danh
  // sách chờ người xác nhận chứ không tự gán.
  const key = byName.has(nodau(meta.name)) ? nodau(meta.name) : nodau(sheetName)
  const byN = byName.get(key)
  if (!byN) return null
  const cust = nodau(byN.customer_name)
  if (cust && cust.length >= 4 && nodau(fileName).includes(cust))
    return { p: byN, how: 'tên SP + tên khách' }
  if (nameCount.get(key) === 1 && key.split(' ').filter(Boolean).length >= 3)
    return { p: byN, how: 'tên SP đặc trưng' }
  return { p: byN, how: 'CHỜ XÁC NHẬN — chỉ trùng tên', weak: true }
}

/* ── Duyệt kho file ──────────────────────────────────────────────────────── */
const files = readdirSync(DIR)
  .filter((f) => /\.xlsx?$/i.test(f) && !f.startsWith('~$'))
  .filter((f) => !only || f.toLowerCase().includes(only.toLowerCase()))

const plan = [] // { file, sheet, product, parts }
const unmatched = []
const weak = []
const assets = []
const skippedHasParts = []
let totalRows = 0

for (const file of files) {
  let wb
  try {
    // `bookFiles` giữ nguyên các entry của gói zip — cần để moi ảnh nhúng.
    wb = XLSX.readFile(`${DIR}/${file}`, { bookFiles: true })
  } catch (e) {
    unmatched.push({ file, sheet: '-', reason: 'không đọc được: ' + e.message })
    continue
  }
  for (const [sheetIndex, sheetName] of wb.SheetNames.entries()) {
    const grid = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: null,
    })
    if (grid.length < 8) continue
    const { meta, parts } = readSheet(grid)
    if (parts.length === 0) continue
    const pics = imagesOf(wb, sheetIndex)
    const m = matchProduct(meta, file, sheetName)
    if (!m) {
      unmatched.push({
        file,
        sheet: sheetName,
        reason: `chưa có hồ sơ — HG "${meta.hg || '?'}" · khách "${meta.cust || '?'}" · tên "${meta.name || '?'}"`,
        rows: parts.length,
        meta,
        parts,
        pics,
        sheetIndex,
        wbFiles: wb.files,
      })
      continue
    }
    // Mọi sheet KHỚP được hồ sơ đều là nguồn ẢNH + FILE LƯU TRỮ cho hồ sơ đó,
    // kể cả sheet không nạp định mức (SP đã có bảng nhập tay).
    assets.push({
      productId: m.p.id,
      code: m.p.code,
      file,
      sheet: sheetName,
      pics,
      wbFiles: wb.files,
    })
    if (already.has(m.p.id)) {
      skippedHasParts.push({ file, sheet: sheetName, code: m.p.code, rows: parts.length })
      continue
    }
    if (m.weak) {
      weak.push({
        file,
        sheet: sheetName,
        code: m.p.code,
        name: m.p.name,
        rows: parts.length,
      })
      continue
    }
    plan.push({
      file,
      sheet: sheetName,
      product: m.p,
      how: m.how,
      parts,
      pics,
      wbFiles: wb.files,
    })
    totalRows += parts.length
  }
}

// Một SP chỉ nhận MỘT nguồn — file trùng mã thì giữ nguồn nhiều dòng nhất.
const bestByProduct = new Map()
for (const it of plan) {
  const cur = bestByProduct.get(it.product.id)
  if (!cur || it.parts.length > cur.parts.length) bestByProduct.set(it.product.id, it)
}
const final = [...bestByProduct.values()]
const dupes = plan.length - final.length

console.log(`\n=== DÒ KHÔ ===`)
console.log(`File quét            : ${files.length}`)
console.log(`Sheet khớp hồ sơ     : ${final.length} (bỏ ${dupes} sheet trùng SP)`)
console.log(`Dòng định mức sẽ nạp : ${final.reduce((n, x) => n + x.parts.length, 0)}`)
console.log(`Bỏ vì SP ĐÃ có định mức: ${skippedHasParts.length} sheet`)
console.log(`Không khớp hồ sơ nào : ${unmatched.length} sheet`)
console.log(`CHỜ XÁC NHẬN (chỉ trùng tên): ${weak.length} sheet`)

const byGroup = new Map()
for (const it of final)
  for (const p of it.parts)
    byGroup.set(p.group_code, (byGroup.get(p.group_code) ?? 0) + 1)
console.log(`\nDòng theo nhóm:`)
for (const [g, n] of [...byGroup].sort((a, b) => b[1] - a[1]))
  console.log(`  ${g.padEnd(10)} ${n}`)

console.log(`\nCách khớp:`)
const byHow = new Map()
for (const it of final) byHow.set(it.how, (byHow.get(it.how) ?? 0) + 1)
for (const [h, n] of byHow) console.log(`  ${h.padEnd(16)} ${n}`)

writeFileSync(
  `${SCRATCH}/bom-plan.txt`,
  final
    .map((x) =>
      [
        x.how,
        x.product.code,
        x.product.name,
        `${x.parts.length} dòng`,
        `${x.file} · ${x.sheet}`,
      ].join('\t'),
    )
    .sort()
    .join('\n'),
  'utf8',
)
writeFileSync(
  `${SCRATCH}/bom-unmatched.txt`,
  unmatched.map((u) => [u.file, u.sheet, u.rows ?? 0, u.reason].join('\t')).join('\n'),
  'utf8',
)

console.log(`\n— 15 sheet KHÔNG khớp hồ sơ (mẫu) —`)
for (const u of unmatched.slice(0, 15))
  console.log(`  ${u.file} · ${u.sheet} → ${u.reason}`)
if (unmatched.length > 15) console.log(`  … còn ${unmatched.length - 15}`)

/* ── Khai hồ sơ cho sheet chưa có SP (--create-missing) ──────────────────── */
const serials = new Map() // loại → serial kế tiếp
for (const p of products) {
  const m = /^([A-Z]{2})(\d{4,6})HG-[A-Z]{2}$/.exec(s(p.code))
  if (!m) continue
  const cur = serials.get(m[1]) ?? 0
  serials.set(m[1], Math.max(cur, Number(m[2])))
}
const mintCode = (type, mat) => {
  const next = (serials.get(type) ?? 0) + 1
  serials.set(type, next)
  return `${type}${String(next).padStart(4, '0')}HG-${mat}`
}

const toCreate = []
if (CREATE) {
  // Một SHEET = một SP. File tổng nhiều sheet thì mỗi sheet một hồ sơ riêng.
  const seen = new Set()
  for (const u of unmatched) {
    if (!u.parts?.length) continue
    const rawName = cleanName(u.meta, u.file, u.sheet)
    if (!rawName) {
      noName.push(u)
      continue
    }
    const key = nodau(rawName) + '|' + nodau(u.file)
    if (seen.has(key)) continue
    seen.add(key)
    // File ROSCO đặt tên theo số thứ tự ("12", "693T") — tên đó vào thư viện là
    // vô nghĩa, gắn thêm tên khách cho còn nhận ra được.
    const cust = customerOf(u.meta ?? {}, u.file)
    const name =
      rawName.length < 6 || /^[\d,\s]+$/.test(rawName)
        ? [cust, rawName].filter(Boolean).join(' ')
        : rawName
    const type = typeOf(name)
    const mat = matOf(u.meta?.fuel, name, u.parts, u.file)
    toCreate.push({
      ...u,
      row: {
        code: mintCode(type, mat),
        name: name.slice(0, 200),
        code_legacy: s(u.meta?.hg) || codesIn(u.sheet)[0] || null,
        customer_item_code: s(u.meta?.cust) || null,
        customer_name: cust,
        base_material: mat === 'XX' ? null : mat,
      },
    })
  }
  console.log(`\n=== KHAI HỒ SƠ MỚI ===`)
  console.log(
    `Sẽ tạo   : ${toCreate.length} SP · ${toCreate.reduce((n, x) => n + x.parts.length, 0)} dòng định mức`,
  )
  console.log(`Có ảnh   : ${toCreate.filter((x) => x.pics?.length).length}`)
  console.log(`Bỏ (tờ không ghi tên SP): ${noName.length}`)
  const byType = new Map()
  for (const t of toCreate) {
    const k = t.row.code.slice(0, 2)
    byType.set(k, (byType.get(k) ?? 0) + 1)
  }
  console.log(`Theo loại: ${[...byType].map(([k, n]) => `${k} ${n}`).join(' · ')}`)
  writeFileSync(
    `${SCRATCH}/bom-create.txt`,
    toCreate
      .map((x) =>
        [
          x.row.code,
          x.row.name,
          x.row.customer_name ?? '',
          x.row.code_legacy ?? '',
          `${x.parts.length} dòng`,
          x.pics?.length ? 'có ảnh' : '',
          `${x.file} · ${x.sheet}`,
        ].join('\t'),
      )
      .join('\n'),
    'utf8',
  )
}

if (!APPLY) {
  console.log(`\nDò khô — chưa ghi gì. Thêm --apply để nạp.\n`)
  process.exit(0)
}

/* ── Ảnh: tải lên Storage + bảng files, rồi gắn làm ảnh đại diện ───────────
 * Cùng đường với `scripts/import-products.mjs`: bucket `attachments`, path
 * `product/<id>/<uuid>-<tên>`, ghi một dòng `files` rồi trỏ `image_file_id`.
 */
const BUCKET = 'attachments'
const mimeOf = (p) =>
  /\.png$/i.test(p)
    ? 'image/png'
    : /\.gif$/i.test(p)
      ? 'image/gif'
      : /\.jpe?g$/i.test(p)
        ? 'image/jpeg'
        : 'application/octet-stream'

async function attachImage(productId, code, pic, wbFiles) {
  const entry = wbFiles?.[pic.path]
  if (!entry) return false
  const buf = Buffer.from(entry.content)
  if (buf.length < 4000) return false // ảnh quá nhỏ = icon/khung, không phải ảnh SP
  const ext = pic.path.slice(pic.path.lastIndexOf('.'))
  const filename = `${code}${ext}`
  const path = `product/${productId}/${randomUUID()}-${filename}`
  const up = await db.storage
    .from(BUCKET)
    .upload(path, buf, { contentType: mimeOf(pic.path), upsert: false })
  if (up.error) throw new Error(`upload ${code}: ${up.error.message}`)
  const { data: frow, error } = await db
    .from('files')
    .insert({
      bucket: BUCKET,
      path,
      filename,
      mime_type: mimeOf(pic.path),
      size_bytes: buf.length,
      doc_type: 'image',
      product_id: productId,
      finalized_at: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error) throw new Error(`files ${code}: ${error.message}`)
  await db
    .from('technical_products')
    .update({ image_file_id: frow.id })
    .eq('id', productId)
  return true
}

/** Ghi cụm + dòng định mức cho một hồ sơ. */
async function writeParts(productId, code, parts) {
  const clusterIds = new Map()
  for (const nameC of [...new Set(parts.map((p) => p.cluster_raw).filter(Boolean))]) {
    const { data, error } = await db
      .from('technical_product_clusters')
      .insert({ product_id: productId, name: nameC })
      .select('id')
      .single()
    if (error) throw new Error(`cụm "${nameC}" (${code}): ${error.message}`)
    clusterIds.set(nameC, data.id)
  }
  const rows = parts.map((p, i) => ({
    product_id: productId,
    group_code: p.group_code,
    section_title: p.section_title,
    cluster_id: p.cluster_raw ? (clusterIds.get(p.cluster_raw) ?? null) : null,
    part_no: p.part_no,
    part_name: p.part_name,
    profile_shape: p.profile_shape,
    profile_code: p.profile_code,
    dim_a_mm: p.dim_a_mm,
    dim_b_mm: p.dim_b_mm,
    wall_thickness_mm: p.wall_thickness_mm,
    cut_length_mm: p.cut_length_mm,
    bend_waste_mm: p.bend_waste_mm,
    tenon_mm: p.tenon_mm,
    qty: p.qty,
    unit: p.unit,
    material_note: p.material_note,
    weight_kg: p.weight_kg,
    note: p.note,
    sort_order: i + 1,
  }))
  const { error } = await db.from('technical_product_parts').insert(rows)
  if (error) throw new Error(`${code}: ${error.message}`)
}

/* ── Khai hồ sơ mới ──────────────────────────────────────────────────────── */
let created = 0
let imgOk = 0
let imgFail = 0
for (const it of toCreate) {
  const { data: prod, error } = await db
    .from('technical_products')
    .insert(it.row)
    .select('id')
    .single()
  if (error) {
    console.error(`  ✗ ${it.row.code} "${it.row.name}": ${error.message}`)
    continue
  }
  // Một tờ hỏng không được làm sập cả mẻ, và không được để lại hồ sơ rỗng:
  // ghi dòng lỗi thì xoá luôn hồ sơ vừa tạo rồi đi tiếp.
  try {
    await writeParts(prod.id, it.row.code, it.parts)
  } catch (e) {
    console.error(`  ✗ ${it.row.code} "${it.row.name}": ${e.message} — bỏ hồ sơ này`)
    await db.from('technical_product_clusters').delete().eq('product_id', prod.id)
    await db.from('technical_product_parts').delete().eq('product_id', prod.id)
    await db.from('technical_products').delete().eq('id', prod.id)
    continue
  }
  if (IMAGES && it.pics?.length) {
    try {
      if (await attachImage(prod.id, it.row.code, it.pics[0], it.wbFiles)) imgOk++
    } catch (e) {
      imgFail++
      console.error(`  ✗ ảnh ${it.row.code}: ${e.message}`)
    }
  }
  created++
  if (created % 25 === 0) console.log(`  … khai ${created}/${toCreate.length} SP`)
}
if (CREATE) console.log(`\nĐÃ KHAI ${created} hồ sơ · ${imgOk} ảnh (lỗi ${imgFail}).`)

/* ── Ghi thật ────────────────────────────────────────────────────────────── */
let done = 0
for (const it of final) {
  // Cụm: tạo trước, lấy id
  const clusterIds = new Map()
  const names = [...new Set(it.parts.map((p) => p.cluster_raw).filter(Boolean))]
  for (const nameC of names) {
    const { data, error } = await db
      .from('technical_product_clusters')
      .insert({ product_id: it.product.id, name: nameC })
      .select('id')
      .single()
    if (error) throw new Error(`cụm "${nameC}" (${it.product.code}): ${error.message}`)
    clusterIds.set(nameC, data.id)
  }
  const rows = it.parts.map((p, i) => ({
    product_id: it.product.id,
    group_code: p.group_code,
    section_title: p.section_title,
    cluster_id: p.cluster_raw ? (clusterIds.get(p.cluster_raw) ?? null) : null,
    part_no: p.part_no,
    part_name: p.part_name,
    profile_shape: p.profile_shape,
    profile_code: p.profile_code,
    dim_a_mm: p.dim_a_mm,
    dim_b_mm: p.dim_b_mm,
    wall_thickness_mm: p.wall_thickness_mm,
    cut_length_mm: p.cut_length_mm,
    bend_waste_mm: p.bend_waste_mm,
    tenon_mm: p.tenon_mm,
    qty: p.qty,
    unit: p.unit,
    material_note: p.material_note,
    weight_kg: p.weight_kg,
    note: p.note,
    sort_order: i + 1,
  }))
  const { error } = await db.from('technical_product_parts').insert(rows)
  if (error) throw new Error(`${it.product.code}: ${error.message}`)
  done++
  if (done % 20 === 0) console.log(`  … ${done}/${final.length} SP`)
}
console.log(`\nĐÃ NẠP ${done} sản phẩm.\n`)

/* ── Rà và bổ sung: ẢNH đại diện + FILE BOM lưu trữ ────────────────────────
 * Hồ sơ có rồi nhưng thiếu ảnh / thiếu file gốc thì bù từ chính tờ BOM đã khớp.
 * Chạy lại được: SP đã có ảnh thì không đè, đã có file BOM cùng tên thì bỏ qua.
 */
if (IMAGES || ATTACH) {
  const MAX_FILE = 10 * 1024 * 1024 // trần doc_type 'bom' (src/lib/file-limits.ts)
  const noImage = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('technical_products')
      .select('id')
      .is('image_file_id', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data) noImage.add(r.id)
    if (data.length < 1000) break
  }
  const hasBomFile = new Set()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('files')
      .select('product_id')
      .eq('doc_type', 'bom')
      .is('deleted_at', null)
      .not('product_id', 'is', null)
      .range(from, from + 999)
    if (error) throw new Error(error.message)
    for (const r of data) hasBomFile.add(r.product_id)
    if (data.length < 1000) break
  }

  let addImg = 0
  let addFile = 0
  let skipBig = 0
  const doneImg = new Set()
  const doneFile = new Set()
  for (const a of assets) {
    if (
      IMAGES &&
      noImage.has(a.productId) &&
      !doneImg.has(a.productId) &&
      a.pics?.length
    ) {
      try {
        if (await attachImage(a.productId, a.code, a.pics[0], a.wbFiles)) {
          addImg++
          doneImg.add(a.productId)
        }
      } catch (e) {
        console.error(`  ✗ ảnh ${a.code}: ${e.message}`)
      }
    }
    if (ATTACH && !hasBomFile.has(a.productId) && !doneFile.has(a.productId)) {
      try {
        const buf = fs2.readFileSync(`${DIR}/${a.file}`)
        if (buf.length > MAX_FILE) {
          skipBig++
          continue
        }
        const path = `product/${a.productId}/${randomUUID()}-${a.file.replace(/[^A-Za-z0-9._-]+/g, '_')}`
        const up = await db.storage.from(BUCKET).upload(path, buf, {
          contentType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false,
        })
        if (up.error) throw up.error
        const { error } = await db.from('files').insert({
          bucket: BUCKET,
          path,
          filename: a.file,
          mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size_bytes: buf.length,
          doc_type: 'bom',
          product_id: a.productId,
          finalized_at: new Date().toISOString(),
        })
        if (error) throw error
        addFile++
        doneFile.add(a.productId)
      } catch (e) {
        console.error(`  ✗ file ${a.code}: ${e.message}`)
      }
    }
  }
  console.log(
    `BỔ SUNG: ${addImg} ảnh · ${addFile} file BOM lưu trữ${skipBig ? ` · bỏ ${skipBig} file > 10 MB` : ''}\n`,
  )
}
