// NẠP LẠI hồ sơ sản phẩm + định mức từ bộ trích xuất file BOM (DATABASE_SP).
//
//   node scripts/products-import.mjs --src "C:\\Users\\HP\\Downloads\\All Bom\\DATABASE_SP"
//   node scripts/products-import.mjs --src "…\\DATABASE_SP" --apply
//   node scripts/products-import.mjs --src "…\\DATABASE_SP" --apply --skip-images
//   node scripts/products-import.mjs --src "…\\DATABASE_SP" --apply --only C0134HG-IR,S0005HG-AL
//
// Nguồn: <src>/CSV/{san_pham,dinh_muc_vat_tu,kich_thuoc_cau_kien,dong_goi}.csv
//        <src>/ANH_SP/*.{png,jpeg}
//
// Nạp theo thứ tự: sản phẩm → định mức → món trong bộ → đóng gói → ảnh.
// Idempotent: upsert sản phẩm theo `code`; các bảng con thì xoá sạch của đúng
// những sản phẩm sắp nạp rồi ghi lại, nên chạy nhiều lần không sinh trùng.
//
// YÊU CẦU: đã apply 0092, 0093 và 0094 (0094 tạo nhóm NGU_KIM / SON_HC / DAY_DAN).
//
// Quy ước đã chốt (docs/product-profile-redesign-plan.md §7):
//   · code mới  = [loại 2 ký tự][số 6 chữ số]HG-[vật liệu], code_legacy giữ mã cũ
//   · phí hao   = 0; giá trị cột "Phí hao" của file đưa vào ghi chú, chưa dùng
//   · 605 dòng CSV khử trùng lặp còn 438 SP: bỏ bản COPY/CŨ, giữ file mới nhất
//   · định mức chỉ lấy từ ĐÚNG bản file được chọn (tránh trộn định mức bản cũ)

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'
import { client, readCsv, chunk, num, nostr } from './products-lib.mjs'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const SKIP_IMAGES = argv.includes('--skip-images')
const arg = (n) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : null
}
const SRC = arg('--src')
const SQL_DIR = arg('--sql')
const ONLY = arg('--only')
  ? new Set(
      arg('--only')
        .split(',')
        .map((s) => s.trim()),
    )
  : null
if (!SRC) {
  console.error('✗ cần --src <thư mục DATABASE_SP>')
  process.exit(1)
}
const BUCKET = 'attachments'

// ── Bảng mã ────────────────────────────────────────────────────────────────
const TYPE = { T: 'TB', C: 'CH', B: 'BN', S: 'ST', SU: 'SL', O: 'OT', A: 'AC', D: 'OT' }
const MAT = {
  AL: 'AL',
  IR: 'IR',
  IN: 'IN',
  SS: 'IN',
  WD: 'WD',
  PW: 'WD',
  RA: 'RA',
  GL: 'GL',
  XX: 'XX',
}

const SHAPE = {
  hop: 'HOP',
  tron: 'TRON',
  vuong: 'VUONG',
  la: 'LA',
  tole: 'TOLE',
  ton: 'TOLE',
  ovan: 'OVAN',
  tam: 'TAM',
  'profile nep': 'PF',
  profile: 'PF',
  nep: 'PF',
}

/** Nhận diện nhóm hạng mục theo TÊN chi tiết — cột nhóm trong file không tin được
 *  (đã gặp "bulon m6x15" nằm trong nhóm NỆM & VẢI). */
const BY_NAME = [
  [
    'NGU_KIM',
    /bulon|bulong|bluon|buloong|oc vit|\bvit\b|\bvis\b|\btan\b|tan rut|tan du|long den|londen|luc giac|\bpat\b|dinh tan|rivet|ban le|tang do|tang don|\bgot\b|chot|\bkhoa\b|\bmoc\b|banh xe|lo xo|de chan|de nhua|de tang|nut bit|bit dau|dai oc|thanh ren/,
  ],
  ['SON_HC', /\bson\b|bot son|hoa chat|\bkeo\b|dung moi|chong ri|phot phat|silicon/],
  [
    'DAY_DAN',
    /day du|day dan|\bmay\b|textilen|batyline|cong dan|day gan|day dep|rattan|wicker/,
  ],
  ['CUSHION', /\bnem\b|\bmut\b|\bgoi\b|\bbong\b|\bvai\b|bao nem|ruot goi|day keo|ykk/],
  [
    'PACKAGING',
    /thung|carton|\bgiay\b|nilon|nylon|\btui\b|bang keo|\bxop\b|pallet|palet|\btem\b|nhan mac|\bv goc\b|\bv5\b|chen goc|shell|barcode|sticker|hdsd/,
  ],
  ['WOOD', /\bgo\b|polywood|teak|acacia|bach dan|keo tram/],
]
const BY_GROUP = {
  KHUNG: 'FRAME',
  'GO / POLYWOOD': 'WOOD',
  'NEM & VAI': 'CUSHION',
  'VAT TU': 'HARDWARE',
  'BAO BI': 'PACKAGING',
  'DAY DAN': 'DAY_DAN',
  KHAC: 'OTHER',
}

/** `l` là dòng CSV — cần cả quy cách chứ không chỉ tên. */
function groupOf(l) {
  const nhom = l.Nhom_muc
  const t = nostr(l.Ten_chi_tiet)
  const hit = BY_NAME.find(([, re]) => re.test(t))?.[0]
  if (nhom === 'KHUNG') {
    // Trong mục khung, dòng CÓ quy cách phôi (dạng hoặc chiều dài cắt) là chi
    // tiết CẮT/HÀN dù tên nghe như phụ kiện: "Pát chân" La 3×35×60, "Bịt đầu
    // chân", "Đế chân", "Chốt nối tựa" — 672 dòng như vậy. Chỉ dòng không có
    // quy cách nào mới là ngũ kim mua ngoài. "Nan mê" ở đây cũng là ống nhôm,
    // không phải nan gỗ.
    if (l.Loai || l.Dai) return hit === 'SON_HC' ? hit : 'FRAME'
    return hit === 'NGU_KIM' || hit === 'SON_HC' ? hit : 'FRAME'
  }
  return hit ?? BY_GROUP[nhom] ?? 'OTHER'
}

const slug = (s) =>
  nostr(s)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'X'

/** Tách "Loại" thành dạng profile chuẩn hoá hoặc mã khuôn ép. */
function parseLoai(loai) {
  const t = nostr(loai)
  if (!t) return { shape: null, code: null }
  for (const [k, v] of Object.entries(SHAPE))
    if (t === k || t.startsWith(k)) return { shape: v, code: null }
  if (/[a-z]/.test(t) && /\d/.test(t))
    return { shape: 'PF', code: t.toUpperCase().replace(/[^A-Z0-9]/g, '') }
  return { shape: null, code: null }
}

// Ngũ kim viết mỗi nơi một kiểu: "Tán rút M6" · "Tán rut m6" · "TÁN RÚT M6" là
// một thứ; "Vis 4x15", "Vít 4 x15", "Vis ren gỗ 4x15" cũng vậy. Gộp về HỌ + quy
// cách ren để mua hàng cộng được số lượng. Cố ý KHÔNG gộp "tán dù"/"tán cấy" vào
// "tán rút" — khác loại (docs/material-catalog-stage1.md §2).
const HW_FAMILY = [
  ['BULONG', /bulon|bulong|bluon|buloong/],
  ['TANRUT', /tan rut|tan rut/],
  ['TANDU', /tan du/],
  ['TANCAY', /tan cay/],
  ['LONGDEN', /long den|londen/],
  ['VIT', /\bvit\b|\bvis\b/],
  ['LUCGIAC', /luc giac/],
  ['TANGDO', /tang do|tang don/],
  ['DECHAN', /de chan|de nhua|\bgot\b/],
  ['PAT', /\bpat\b/],
  ['BITDAU', /bit dau|nut bit/],
]
function hardwareCode(name) {
  const t = nostr(name)
  const fam = HW_FAMILY.find(([, re]) => re.test(t))?.[0]
  if (!fam) return `VT-PK-${slug(name)}`
  // "M6x20" là ren; số trần "4x15" chỉ nhận khi tên không lẫn phân số/thập phân
  // (tránh "londen 16/6.5x1" → M5X1).
  const m =
    t.match(/\bm\s?(\d+)\s?[x*]\s?(\d+)/) ??
    (!/[/.]/.test(t) ? t.match(/(\d+)\s?[x*]\s?(\d+)/) : null)
  if (m) return `VT-PK-${fam}-M${m[1]}X${m[2]}`
  const m2 = t.match(/\bm\s?(\d+)\b/)
  if (m2) return `VT-PK-${fam}-M${m2[1]}`
  const tail = slug(name)
  return tail.length <= fam.length + 2
    ? `VT-PK-${fam}`
    : `VT-PK-${fam}-${tail.slice(0, 24)}`
}

/** Mã vật tư dạng text (không FK sang kho) — xem docs/material-catalog-stage1.md. */
function materialCode(group, kind, shape, code, a, b, wall, name) {
  if (group === 'FRAME') {
    if (code) return `VT-${kind ?? 'XX'}-PF-${code}`
    if (!shape) return null
    const w = wall ? `x${wall}` : ''
    if (shape === 'TRON' || shape === 'VUONG')
      return a ? `VT-${kind ?? 'XX'}-${shape}-D${a}${w}` : null
    if (shape === 'LA') return a && b ? `VT-${kind ?? 'XX'}-LA-${a}x${b}` : null
    return a && b ? `VT-${kind ?? 'XX'}-${shape}-${a}x${b}${w}` : null
  }
  if (group === 'NGU_KIM') return hardwareCode(name)
  const pre =
    {
      SON_HC: 'SON',
      DAY_DAN: 'DD',
      CUSHION: 'NM',
      WOOD: 'GO',
      PACKAGING: 'BB',
      HARDWARE: 'PK',
    }[group] ?? 'K'
  return `VT-${pre}-${slug(name)}`
}

const MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}
const sanitize = (n) => n.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 100)

// ── Đọc dữ liệu ────────────────────────────────────────────────────────────
const csvDir = join(SRC, 'CSV')
const SP = readCsv(join(csvDir, 'san_pham.csv'))
const DM = readCsv(join(csvDir, 'dinh_muc_vat_tu.csv'))
const CK = readCsv(join(csvDir, 'kich_thuoc_cau_kien.csv'))
const DG = readCsv(join(csvDir, 'dong_goi.csv'))

// Bảng đối mã đã chốt trước đây — giữ nguyên mã mới để chứng từ cũ không lệch.
const mapPath = new URL('../docs/import-templates/0-doi-ma-san-pham.csv', import.meta.url)
const CODE_MAP = new Map()
try {
  for (const r of readCsv(mapPath)) if (r.code_cu) CODE_MAP.set(r.code_cu, r.code_moi)
} catch {
  /* không có file thì tự sinh */
}

function newCode(p) {
  const mapped = CODE_MAP.get(p.Ma_san_pham)
  if (mapped) return mapped
  const m = /^([A-Z]{1,2})(\d{3,4})HG-([A-Z]{2,3})$/.exec(p.Ma_san_pham)
  if (!m) return null
  const t = TYPE[m[1]]
  const mat = MAT[m[3]] ?? m[3]
  return t ? `${t}${String(Number(m[2])).padStart(6, '0')}HG-${mat}` : null
}

// ── Khử trùng lặp 605 dòng → 438 SP ────────────────────────────────────────
// Một mã SP có thể nằm ở NHIỀU FILE (bản COPY/CŨ) và trong một file lại có
// NHIỀU SHEET (bộ sản phẩm: Bàn · Bank I · Ottoman…). Chỉ được khử theo FILE:
// chọn một bản file rồi giữ TOÀN BỘ sheet của bản đó, nếu không sẽ mất cấu kiện.
const byCode = new Map()
for (const p of SP) {
  if (!p.Ma_san_pham) continue
  if (ONLY && !ONLY.has(p.Ma_san_pham)) continue
  byCode.set(p.Ma_san_pham, [...(byCode.get(p.Ma_san_pham) ?? []), p])
}
// Trong một file, nhiều sheet có thể là CẤU KIỆN của bộ (Bàn · Bank I · Ottoman)
// hoặc là PHƯƠNG ÁN của cùng một sản phẩm (Nhôm/Sắt · có foam/không foam ·
// OP1/OP2 · THEO HG/THEO REPORT). Cộng gộp phương án sẽ nhân đôi khối lượng, nên
// phải tách: phương án thì chỉ giữ bản nhiều chi tiết nhất, cấu kiện thì giữ hết.
const VARIANT =
  /^(nhom|sat|inox)\b|\bop\s?\d|option\s?\d|theo (hg|report)|foam|thao roi|^dung |grey|brown|black|white|kinh|polywood|ong \d/
const UNNAMED = /^sheet\s?\d+$/
const baseName = (s) =>
  nostr(s)
    .replace(/\(\s*\d+\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()

function pickSheets(rs) {
  const cnt = (r) => Number(r.So_chi_tiet_khung || 0)
  const bestOf = (a) => [...a].sort((x, y) => cnt(y) - cnt(x))[0]
  const named = rs.filter((r) => !UNNAMED.test(nostr(r.Sheet)))
  let list = named.length ? named : [bestOf(rs)] // "Sheet1/Sheet4" → giữ 1
  if (list.length < 2) return list
  const vari = list.filter((r) => VARIANT.test(nostr(r.Sheet)))
  if (vari.length >= 2 || (vari.length === 1 && list.length === 2)) return [bestOf(list)]
  const byBase = new Map() // "Table" và "Table (2)" là một
  for (const r of list)
    byBase.set(baseName(r.Sheet), [...(byBase.get(baseName(r.Sheet)) ?? []), r])
  return [...byBase.values()].map(bestOf)
}

const chosen = [] // 1 bản ghi/SP, gộp thông tin từ mọi sheet của file được chọn
const chosenIds = new Set() // ID_SP của mọi sheet được giữ
let multiFile = 0,
  droppedSheets = 0
for (const [code, list] of byCode) {
  const files = new Map()
  for (const r of list) files.set(r.File, [...(files.get(r.File) ?? []), r])
  if (files.size > 1) multiFile++
  const scoreFile = (rs) =>
    (rs.some((r) => r.Trang_thai_file) ? 0 : 1e6) + // bản chính hơn COPY/CŨ
    rs.reduce((s, r) => s + Number(r.So_chi_tiet_khung || 0), 0) +
    Math.max(...rs.map((r) => (r.Ngay_sua_file ? Date.parse(r.Ngay_sua_file) / 1e8 : 0)))
  const all = [...files.values()].sort((a, b) => scoreFile(b) - scoreFile(a))[0]
  const rs = pickSheets(all)
  droppedSheets += all.length - rs.length
  for (const r of rs) chosenIds.add(r.ID_SP)
  // Gộp: ưu tiên sheet nhiều chi tiết nhất, ô nào trống thì lấy của sheet sau.
  const order = [...rs].sort(
    (a, b) => Number(b.So_chi_tiet_khung || 0) - Number(a.So_chi_tiet_khung || 0),
  )
  const merged = { ...order[0] }
  for (const r of order.slice(1))
    for (const [k, v] of Object.entries(r)) if (!merged[k] && v) merged[k] = v
  merged.Ma_san_pham = code
  merged._sheets = rs.length
  chosen.push(merged)
}

// Định mức: CHỈ lấy dòng thuộc đúng bản file được chọn.
const partsOf = new Map()
let droppedQty = 0,
  droppedOther = 0
for (const l of DM) {
  if (!chosenIds.has(l.ID_SP)) {
    droppedOther++
    continue
  }
  const qty = num(l.So_luong)
  if (!qty || qty <= 0) {
    droppedQty++
    continue
  }
  partsOf.set(l.Ma_san_pham, [...(partsOf.get(l.Ma_san_pham) ?? []), l])
}

// ── Dựng bản ghi sản phẩm ──────────────────────────────────────────────────
const SHEETISH = new Set([
  'sheet1',
  'sheet2',
  'sheet3',
  'nhom',
  'sat',
  'inox',
  'data',
  '',
])
const setLabel = (s) =>
  SHEETISH.has(nostr(s)) || nostr(s).startsWith('bkqc') ? null : s || null

/** Gom khoảng trắng, bỏ ô rỗng. */
const clean = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim() || null

/**
 * Đơn vị tính của khối định mức, tách từ tiêu đề: "Quy cách nhôm : 1 ghế" → "1 ghế".
 * null = khối tính trên 1 sản phẩm (mặc định).
 *
 * Chỉ xét tiêu đề "Quy cách…" — câu như "Đóng gói 1 cái / thùng" nói về quy cách
 * đóng thùng, không phải căn cứ tính định mức.
 */
function unitBasis(title) {
  const t = clean(title)
  if (!t || !/quy\s*c[áa]ch/i.test(t)) return null
  const m = t.match(/\b(1\s*(?:ghế|ghe|bàn|ban|cái|cai|bộ|bo|chiếc|chiec))\b/i)
  return m ? m[1].replace(/\s+/g, ' ').toLowerCase() : null
}

const rows = [],
  skipped = []
for (const p of chosen) {
  const code = newCode(p)
  if (!code) {
    skipped.push(p.Ma_san_pham)
    continue
  }
  const m = /^([A-Z]{2})(\d{6})HG-([A-Z]{2,3})$/.exec(code)
  const cm = p.KTTT_goc.toLowerCase().includes('cm') ? 10 : 1
  const lines = partsOf.get(p.Ma_san_pham) ?? []
  // technical_products.name giới hạn 1..200 ký tự. Vài "tên" trong file thực ra
  // là cả đoạn mô tả (dài nhất 221) — cắt cho vừa, giữ nguyên bản đầy đủ ở notes.
  const rawName = (p.Ten_san_pham || p.TH_Name_Item || p.Ma_san_pham)
    .replace(/\s+/g, ' ')
    .trim()
  const name = rawName.length > 200 ? rawName.slice(0, 199) + '…' : rawName
  const notes = [
    p.File && p.File !== '(chưa có file BOM)'
      ? `Nguồn: ${p.File}${p.Sheet ? ` :: ${p.Sheet}` : ''}`
      : 'Chưa có file BOM',
    p.Trang_thai_file ? `Trạng thái file: ${p.Trang_thai_file}` : '',
    p.Nguon_ma && p.Nguon_ma !== 'Từ file BOM' ? `Mã: ${p.Nguon_ma}` : '',
    p.TH_Ghi_chu ? `Ghi chú: ${p.TH_Ghi_chu}` : '',
    p.TH_Painting ? `Sơn: ${p.TH_Painting}` : '',
    rawName.length > 200 ? `Tên đầy đủ: ${rawName}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  rows.push({
    _legacy: p.Ma_san_pham,
    _img: p.Anh,
    _loading: num(p.Cai_tren_40HC) ?? num(p.TH_Loading),
    row: {
      code,
      code_legacy: p.Ma_san_pham,
      name,
      product_type: m?.[1] ?? null,
      frame_material: m?.[3] ?? null,
      serial_no: m ? Number(m[2]) : null,
      customer_name: p.Khach_hang || p.TH_Client || null,
      customer_item_code: p.Ma_khach_hang || p.TH_Ma_KH || null,
      material: p.Vat_lieu || null,
      unit: 'cai',
      length_mm: num(p.Dai_mm) != null ? num(p.Dai_mm) * cm : null,
      width_mm: num(p.Rong_mm) != null ? num(p.Rong_mm) * cm : null,
      height_mm: num(p.Cao_mm) != null ? num(p.Cao_mm) * cm : null,
      net_weight_kg: num(p.NW_kg),
      frame_weight_kg: num(p.Tong_KL_khung_kg) ?? num(p.Khoi_luong_kg),
      frame_length_m: num(p.Tong_dai_khung_m),
      paint_area_m2: num(p.Tong_DT_son_m2),
      part_count: num(p.So_chi_tiet_khung),
      is_set: m?.[1] === 'ST',
      is_upholstered: lines.some((l) => groupOf(l) === 'CUSHION'),
      has_glass: /kinh|glass/.test(nostr(name)),
      bom_status: lines.length ? 'done' : 'none',
      notes: notes || null,
      is_active: true,
    },
  })
}

const allParts = [...partsOf.values()].reduce((s, a) => s + a.length, 0)
console.log(
  `\n=== NẠP HỒ SƠ SẢN PHẨM — ${APPLY ? '**APPLY (ghi thật)**' : 'DRY-RUN'} ===\n`,
)
console.log(
  `CSV: ${SP.length} dòng → ${chosen.length} SP duy nhất (${multiFile} SP có nhiều bản file → giữ bản mới nhất; bỏ thêm ${droppedSheets} sheet phương án trùng) → ${rows.length} SP sinh được mã mới`,
)
if (skipped.length)
  console.log(
    `  ! bỏ ${skipped.length} SP không sinh được mã: ${skipped.slice(0, 8).join(', ')}${skipped.length > 8 ? '…' : ''}`,
  )
console.log(
  `Định mức: ${DM.length} dòng → ${allParts} dòng nạp (bỏ ${droppedOther} thuộc bản file khác, ${droppedQty} không có số lượng)`,
)

const gcount = {}
for (const ls of partsOf.values())
  for (const l of ls) {
    const g = groupOf(l)
    gcount[g] = (gcount[g] ?? 0) + 1
  }
console.log(
  'Theo nhóm:',
  Object.entries(gcount)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(' · '),
)
// Mã vật tư gộp được bao nhiêu — số này cho thấy việc chuẩn hoá cách viết có ăn.
const codeSeen = new Map()
for (const [legacy, ls] of partsOf) {
  const kindOf = rows.find((r) => r._legacy === legacy)?.row.frame_material ?? null
  for (const l of ls) {
    const g = groupOf(l)
    const { shape, code } = parseLoai(l.Loai)
    const kind =
      g === 'FRAME' ? (kindOf === 'XX' ? null : kindOf) : g === 'WOOD' ? 'WD' : null
    const mc = materialCode(
      g,
      kind,
      shape,
      code,
      num(l.Day),
      num(l.Rong),
      num(l.Day_vat_lieu),
      l.Ten_chi_tiet,
    )
    if (mc) codeSeen.set(mc, (codeSeen.get(mc) ?? 0) + 1)
  }
}
const nkCodes = [...codeSeen.keys()].filter((c) =>
  /^VT-PK-(BULONG|TANRUT|TANDU|TANCAY|LONGDEN|VIT|LUCGIAC|TANGDO|DECHAN|PAT|BITDAU)/.test(
    c,
  ),
)
console.log(
  `Mã vật tư sinh ra: ${codeSeen.size} mã — trong đó ${nkCodes.length} mã ngũ kim đã gộp cách viết`,
)
console.log(`Món trong bộ: ${CK.length} · dòng đóng gói: ${DG.length}`)

/** Một dòng định mức → các cột của technical_product_parts (chưa có product_id). */
function partFields(l, kindOfProduct, i) {
  const group = groupOf(l)
  const { shape, code } = parseLoai(l.Loai)
  const kind =
    group === 'FRAME'
      ? kindOfProduct === 'XX'
        ? null
        : kindOfProduct
      : group === 'WOOD'
        ? 'WD'
        : null
  const a = num(l.Day),
    b = num(l.Rong),
    wall = num(l.Day_vat_lieu)
  // part_no là int. File đánh STT phụ kiểu "2.1", "3.2", "5.666…" (chi tiết con
  // của mục 2, 3, 5) → lấy phần nguyên, giữ số gốc trong ghi chú để tra lại.
  const sttNum = num(l.STT)
  const sttSub = sttNum != null && !Number.isInteger(sttNum)
  const note = [
    l.Ghi_chu,
    sttSub ? `STT gốc: ${String(l.STT).trim()}` : '',
    l.Phi_hao ? `Phí hao uốn (file): ${l.Phi_hao}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    group_code: group,
    // Tiêu đề khối trong file BOM — mang thông số thật (mật độ mút D23, gỗ +
    // FSC, mã bao bì), nên là cột riêng chứ không nhét vào ghi chú.
    section_title: clean(l.Muc_goc) || null,
    unit_basis: unitBasis(l.Muc_goc),
    material_note: clean(l.Vat_lieu) || null,
    tenon: clean(l.Mong) || null,
    set_item_label: setLabel(l.Bo_phan),
    part_no: sttNum == null ? null : Math.trunc(sttNum),
    part_name: l.Ten_chi_tiet || '(không tên)',
    material_code: materialCode(group, kind, shape, code, a, b, wall, l.Ten_chi_tiet),
    material_kind: kind,
    profile_shape: shape,
    profile_code: code,
    dim_a_mm: a,
    dim_b_mm: b,
    wall_thickness_mm: wall,
    cut_length_mm: num(l.Dai),
    qty: num(l.So_luong),
    unit: l.DVT || null,
    waste_pct: 0,
    weight_kg: num(l.Trong_luong_kg),
    total_length_m: num(l.Tong_chieu_dai_m),
    paint_area_m2: num(l.Dien_tich_m2),
    volume_m3: num(l.The_tich_m3),
    unit_price: num(l.Don_gia),
    amount: num(l.Thanh_tien),
    note: note || null,
    sort_order: i,
  }
}

/** Gom các dòng đóng gói của một SP thành từng phương án (ô "Option" là ô gộp
 *  trong Excel: chỉ ghi ở dòng đầu mỗi phương án). */
function packingGroups(list) {
  const groups = []
  let cur = null
  for (const d of list) {
    if (d.Option || !cur) {
      cur = { label: d.Option ? d.Option.replace(/\s+/g, ' ').trim() : null, rows: [] }
      groups.push(cur)
    }
    cur.rows.push(d)
  }
  return groups
}

// ── Chế độ xuất SQL ────────────────────────────────────────────────────────
// Dùng khi nạp qua Supabase MCP / SQL editor thay vì gọi API từ máy. Bảng con
// nối với sản phẩm QUA `code` (VALUES … JOIN technical_products) nên không phải
// biết trước uuid. Ảnh KHÔNG nằm trong SQL — Storage phải upload bằng script.
if (SQL_DIR) {
  const { writeFileSync, mkdirSync } = await import('node:fs')
  mkdirSync(SQL_DIR, { recursive: true })
  const q = (v) =>
    v === null || v === undefined || v === ''
      ? 'NULL'
      : `'${String(v).replace(/'/g, "''")}'`
  const n = (v) => (v === null || v === undefined || v === '' ? 'NULL' : Number(v))
  const b = (v) => (v ? 'true' : 'false')
  const files = []
  const put = (name, sql) => {
    writeFileSync(join(SQL_DIR, name), sql)
    files.push(name)
  }

  const P_COLS = [
    'code',
    'code_legacy',
    'name',
    'product_type',
    'frame_material',
    'serial_no',
    'customer_name',
    'customer_item_code',
    'material',
    'unit',
    'length_mm',
    'width_mm',
    'height_mm',
    'net_weight_kg',
    'frame_weight_kg',
    'frame_length_m',
    'paint_area_m2',
    'part_count',
    'is_set',
    'is_upholstered',
    'has_glass',
    'bom_status',
    'notes',
    'is_active',
  ]
  const pVals = rows
    .map(
      ({ row: r }) =>
        `(${q(r.code)},${q(r.code_legacy)},${q(r.name)},${q(r.product_type)},${q(r.frame_material)},${n(r.serial_no)},` +
        `${q(r.customer_name)},${q(r.customer_item_code)},${q(r.material)},${q(r.unit)},${n(r.length_mm)},${n(r.width_mm)},` +
        `${n(r.height_mm)},${n(r.net_weight_kg)},${n(r.frame_weight_kg)},${n(r.frame_length_m)},${n(r.paint_area_m2)},` +
        `${n(r.part_count)},${b(r.is_set)},${b(r.is_upholstered)},${b(r.has_glass)},${q(r.bom_status)},${q(r.notes)},true)`,
    )
    .join(',\n')
  put(
    '10_products.sql',
    `insert into public.technical_products (${P_COLS.join(', ')}) values\n${pVals}\n` +
      `on conflict (code) do update set ` +
      P_COLS.filter((c) => c !== 'code')
        .map((c) => `${c} = excluded.${c}`)
        .join(', ') +
      ';\n',
  )

  // Định mức: VALUES (kèm mã SP) JOIN technical_products — khỏi cần biết uuid.
  const PT_COLS = [
    'group_code',
    'section_title',
    'unit_basis',
    'material_note',
    'tenon',
    'set_item_label',
    'part_no',
    'part_name',
    'material_code',
    'material_kind',
    'profile_shape',
    'profile_code',
    'dim_a_mm',
    'dim_b_mm',
    'wall_thickness_mm',
    'cut_length_mm',
    'qty',
    'unit',
    'waste_pct',
    'weight_kg',
    'total_length_m',
    'paint_area_m2',
    'volume_m3',
    'unit_price',
    'amount',
    'note',
    'sort_order',
  ]
  const PT_CAST = {
    part_no: 'int',
    dim_a_mm: 'numeric',
    dim_b_mm: 'numeric',
    wall_thickness_mm: 'numeric',
    cut_length_mm: 'numeric',
    qty: 'numeric',
    waste_pct: 'numeric',
    weight_kg: 'numeric',
    total_length_m: 'numeric',
    paint_area_m2: 'numeric',
    volume_m3: 'numeric',
    unit_price: 'numeric',
    amount: 'numeric',
    sort_order: 'int',
  }
  const ptLines = []
  for (const [legacy, lines] of partsOf) {
    const r = rows.find((x) => x._legacy === legacy)
    if (!r) continue
    lines.forEach((l, i) => {
      const f = partFields(l, r.row.frame_material, i)
      ptLines.push(
        `(${q(r.row.code)},` +
          PT_COLS.map((c) => (PT_CAST[c] ? n(f[c]) : q(f[c]))).join(',') +
          ')',
      )
    })
  }
  const ptSelect = PT_COLS.map((c) =>
    PT_CAST[c] ? `v.${c}::${PT_CAST[c]}` : `v.${c}`,
  ).join(', ')
  chunk(ptLines, 400).forEach((part, i) =>
    put(
      `20_parts_${String(i + 1).padStart(2, '0')}.sql`,
      `insert into public.technical_product_parts (product_id, ${PT_COLS.join(', ')})\n` +
        `select p.id, ${ptSelect}\nfrom (values\n${part.join(',\n')}\n) as v(code, ${PT_COLS.join(', ')})\n` +
        `join public.technical_products p on p.code = v.code;\n`,
    ),
  )

  // Món trong bộ
  const siLines = []
  const siSeen = new Map()
  for (const c of CK) {
    const r = rows.find((x) => x._legacy === c.Ma_san_pham)
    if (!r || !c.Bo_phan) continue
    const k = siSeen.get(r.row.code) ?? 0
    siSeen.set(r.row.code, k + 1)
    siLines.push(
      `(${q(r.row.code)},${q(c.Bo_phan)},${n(num(c.So_luong) ?? 1)},${n(num(c.Dai_mm))},` +
        `${n(num(c.Rong_mm))},${n(num(c.Cao_mm))},${n(num(c.Net_weight_kg))},${k})`,
    )
  }
  if (siLines.length)
    put(
      '30_set_items.sql',
      `insert into public.technical_product_set_items\n` +
        `  (set_product_id, item_label, qty, length_mm, width_mm, height_mm, net_weight_kg, sort_order)\n` +
        `select p.id, v.item_label, v.qty::numeric, v.length_mm::numeric, v.width_mm::numeric,\n` +
        `       v.height_mm::numeric, v.net_weight_kg::numeric, v.sort_order::int\n` +
        `from (values\n${siLines.join(',\n')}\n) as v(code, item_label, qty, length_mm, width_mm, height_mm, net_weight_kg, sort_order)\n` +
        `join public.technical_products p on p.code = v.code;\n`,
    )

  // Đóng gói: phương án + kiện trong cùng một câu (CTE trả về id phương án).
  const optLines = [],
    pkgLines = []
  const dgByCode = new Map()
  for (const d of DG)
    dgByCode.set(d.Ma_san_pham, [...(dgByCode.get(d.Ma_san_pham) ?? []), d])
  for (const r of rows) {
    const list = dgByCode.get(r._legacy)
    if (!list) {
      if (r._loading != null)
        optLines.push(`(${q(r.row.code)},1,NULL,NULL,${Math.round(r._loading)},true)`)
      continue
    }
    packingGroups(list).forEach((g, i) => {
      const loading =
        g.rows.map((x) => num(x.Loading)).find((v) => v != null) ?? r._loading ?? null
      optLines.push(
        `(${q(r.row.code)},${i + 1},${q(g.label)},${g.rows.length},${loading != null ? Math.round(loading) : 'NULL'},${i === 0})`,
      )
      g.rows.forEach((x, j) =>
        pkgLines.push(
          `(${q(r.row.code)},${i + 1},${q(x.Kien_hang || `Kiện ${j + 1}`)},${n(num(x.Carton_D_mm))},` +
            `${n(num(x.Carton_R_mm))},${n(num(x.Carton_C_mm))},${n(num(x.Gross_weight_kg))},${j})`,
        ),
      )
    })
  }
  if (optLines.length)
    put(
      '40_packing.sql',
      `with o as (\n` +
        `  insert into public.technical_packing_options\n` +
        `    (product_id, option_no, label, cartons_per_set, loading_40hc, is_default)\n` +
        `  select p.id, v.option_no::int, v.label, v.cartons_per_set::int, v.loading_40hc::int, v.is_default::boolean\n` +
        `  from (values\n${optLines.join(',\n')}\n  ) as v(code, option_no, label, cartons_per_set, loading_40hc, is_default)\n` +
        `  join public.technical_products p on p.code = v.code\n` +
        `  returning id, product_id, option_no\n)\n` +
        `insert into public.technical_packages\n` +
        `  (option_id, package_label, qty, carton_l_mm, carton_w_mm, carton_h_mm, gross_weight_kg, sort_order)\n` +
        `select o.id, k.package_label, 1, k.carton_l_mm::numeric, k.carton_w_mm::numeric,\n` +
        `       k.carton_h_mm::numeric, k.gross_weight_kg::numeric, k.sort_order::int\n` +
        `from (values\n${pkgLines.join(',\n')}\n) as k(code, option_no, package_label, carton_l_mm, carton_w_mm, carton_h_mm, gross_weight_kg, sort_order)\n` +
        `join public.technical_products p on p.code = k.code\n` +
        `join o on o.product_id = p.id and o.option_no = k.option_no::int;\n`,
    )

  console.log(
    `\n✓ Đã xuất ${files.length} file SQL vào ${SQL_DIR}:\n  ${files.join('\n  ')}`,
  )
  console.log(
    '  (ảnh không có trong SQL — chạy lại script với --apply để upload Storage)',
  )
  process.exit(0)
}

if (!APPLY) {
  console.log('\n5 SP đầu:')
  for (const r of rows.slice(0, 5))
    console.log(
      `  ${r.row.code} ← ${r._legacy} | ${r.row.name.slice(0, 38)} | ${(partsOf.get(r._legacy) ?? []).length} dòng ĐM`,
    )
  console.log(
    '\n(dry-run) Chạy lại với --apply để ghi thật, hoặc --sql <thư mục> để xuất SQL.',
  )
  process.exit(0)
}

// ── Ghi ────────────────────────────────────────────────────────────────────
const sb = await client(import.meta.url)

/** Ghi theo lô; lô nào lỗi thì ghi lại từng dòng để khoanh đúng dòng hỏng và
 *  vẫn giữ được phần còn lại — một ô rác trong Excel không nên chặn cả đợt nạp. */
async function insertRows(table, list, size = 500) {
  let ok = 0,
    fail = 0
  for (const part of chunk(list, size)) {
    const { error } = await sb.from(table).insert(part)
    if (!error) {
      ok += part.length
      continue
    }
    for (const row of part) {
      const { error: e1 } = await sb.from(table).insert(row)
      if (e1) {
        fail++
        if (fail <= 8)
          console.error(
            `  ✗ ${table}: ${e1.message} → ${JSON.stringify(row).slice(0, 160)}`,
          )
      } else ok++
    }
  }
  if (fail) console.error(`  ! ${table}: bỏ ${fail} dòng lỗi (xem ở trên)`)
  return { ok, fail }
}

let okP = 0
for (const part of chunk(
  rows.map((r) => r.row),
  200,
)) {
  const { error } = await sb
    .from('technical_products')
    .upsert(part, { onConflict: 'code' })
  if (error) {
    console.error(`✗ upsert SP: ${error.message}`)
    process.exit(1)
  }
  okP += part.length
}
console.log(`✓ Sản phẩm: ${okP}`)

const { data: dbRows, error: e2 } = await sb
  .from('technical_products')
  .select('id, code')
  .in(
    'code',
    rows.map((r) => r.row.code),
  )
if (e2) throw new Error(e2.message)
const idOf = new Map(dbRows.map((r) => [r.code, r.id]))
const idByLegacy = new Map(
  rows.map((r) => [r._legacy, idOf.get(r.row.code)]).filter(([, v]) => v),
)
const ids = [...idByLegacy.values()]

// Xoá sạch dữ liệu con của đúng những SP sắp nạp (chạy lại không sinh trùng).
for (const part of chunk(ids, 200)) {
  await sb.from('technical_product_parts').delete().in('product_id', part)
  await sb.from('technical_product_set_items').delete().in('set_product_id', part)
  const { data: opts } = await sb
    .from('technical_packing_options')
    .select('id')
    .in('product_id', part)
  if (opts?.length)
    await sb
      .from('technical_packages')
      .delete()
      .in(
        'option_id',
        opts.map((o) => o.id),
      )
  await sb.from('technical_packing_options').delete().in('product_id', part)
}

// ── Định mức ───────────────────────────────────────────────────────────────
const partRows = []
for (const [legacy, lines] of partsOf) {
  const pid = idByLegacy.get(legacy)
  if (!pid) continue
  const kindOfProduct = rows.find((r) => r._legacy === legacy)?.row.frame_material ?? null
  lines.forEach((l, i) =>
    partRows.push({ product_id: pid, ...partFields(l, kindOfProduct, i) }),
  )
}
console.log(
  `✓ Định mức: ${(await insertRows('technical_product_parts', partRows)).ok} dòng`,
)

// ── Món trong bộ ───────────────────────────────────────────────────────────
const setRows = []
const seenSet = new Map()
for (const c of CK) {
  const pid = idByLegacy.get(c.Ma_san_pham)
  if (!pid || !c.Bo_phan) continue
  const n = seenSet.get(pid) ?? 0
  seenSet.set(pid, n + 1)
  setRows.push({
    set_product_id: pid,
    item_label: c.Bo_phan,
    qty: num(c.So_luong) ?? 1,
    length_mm: num(c.Dai_mm),
    width_mm: num(c.Rong_mm),
    height_mm: num(c.Cao_mm),
    net_weight_kg: num(c.Net_weight_kg),
    sort_order: n,
  })
}
console.log(
  `✓ Món trong bộ: ${(await insertRows('technical_product_set_items', setRows)).ok}`,
)

// ── Đóng gói ───────────────────────────────────────────────────────────────
// Ô "Option" chỉ ghi ở dòng đầu mỗi phương án (ô gộp trong Excel) → điền xuôi.
const byProduct = new Map()
for (const d of DG) {
  if (!idByLegacy.has(d.Ma_san_pham)) continue
  byProduct.set(d.Ma_san_pham, [...(byProduct.get(d.Ma_san_pham) ?? []), d])
}
let optN = 0,
  pkgN = 0
for (const [legacy, list] of byProduct) {
  const pid = idByLegacy.get(legacy)
  for (const [i, g] of packingGroups(list).entries()) {
    const loading =
      g.rows.map((r) => num(r.Loading)).find((v) => v != null) ??
      rows.find((r) => r._legacy === legacy)?._loading ??
      null
    const { data: opt, error } = await sb
      .from('technical_packing_options')
      .insert({
        product_id: pid,
        option_no: i + 1,
        label: g.label ? g.label.replace(/\s+/g, ' ').trim() : null,
        cartons_per_set: g.rows.length,
        loading_40hc: loading != null ? Math.round(loading) : null,
        is_default: i === 0,
      })
      .select('id')
      .single()
    if (error) {
      console.error(`✗ đóng gói ${legacy}: ${error.message}`)
      continue
    }
    optN++
    const pkgs = g.rows.map((r, j) => ({
      option_id: opt.id,
      package_label: r.Kien_hang || `Kiện ${j + 1}`,
      qty: 1,
      carton_l_mm: num(r.Carton_D_mm),
      carton_w_mm: num(r.Carton_R_mm),
      carton_h_mm: num(r.Carton_C_mm),
      gross_weight_kg: num(r.Gross_weight_kg),
      sort_order: j,
    }))
    const { error: pe } = await sb.from('technical_packages').insert(pkgs)
    if (pe) console.error(`✗ kiện ${legacy}: ${pe.message}`)
    else pkgN += pkgs.length
  }
}
// SP không có dòng đóng gói nhưng biết số xếp cont → vẫn lưu một phương án.
const loadOnly = rows.filter(
  (r) => r._loading != null && !byProduct.has(r._legacy) && idByLegacy.get(r._legacy),
)
for (const part of chunk(loadOnly, 200)) {
  const { error } = await sb.from('technical_packing_options').insert(
    part.map((r) => ({
      product_id: idByLegacy.get(r._legacy),
      option_no: 1,
      label: null,
      loading_40hc: Math.round(r._loading),
      is_default: true,
    })),
  )
  if (error) console.error(`✗ đóng gói (chỉ loading): ${error.message}`)
  else optN += part.length
}
console.log(`✓ Đóng gói: ${optN} phương án · ${pkgN} kiện`)

// ── Ảnh ────────────────────────────────────────────────────────────────────
if (SKIP_IMAGES) {
  console.log('· Ảnh: bỏ qua (--skip-images)')
} else {
  const imgDir = join(SRC, 'ANH_SP')
  const have = existsSync(imgDir) ? new Set(readdirSync(imgDir)) : new Set()
  // Ảnh đã upload lần trước thì bỏ qua — chạy lại script không được đẻ thêm bản
  // sao trong Storage (Storage không có khoá duy nhất theo tên).
  const uploaded = new Set()
  for (const part of chunk(ids, 200)) {
    const { data } = await sb
      .from('files')
      .select('product_id, filename')
      .eq('doc_type', 'image')
      .is('deleted_at', null)
      .in('product_id', part)
    for (const f of data ?? []) uploaded.add(`${f.product_id}::${f.filename}`)
  }
  let okI = 0,
    skipI = 0,
    failI = 0
  for (const r of rows) {
    const pid = idByLegacy.get(r._legacy)
    if (!pid || !r._img) continue
    const fname = basename(r._img)
    if (!have.has(fname)) continue
    if (uploaded.has(`${pid}::${fname}`)) {
      skipI++
      continue
    }
    try {
      const buf = readFileSync(join(imgDir, fname))
      const path = `product/${pid}/${randomUUID()}-${sanitize(fname)}`
      const mime = MIME[extname(fname).toLowerCase()] ?? 'application/octet-stream'
      const up = await sb.storage
        .from(BUCKET)
        .upload(path, buf, { contentType: mime, upsert: false })
      if (up.error) throw up.error
      const { data: frow, error: fe } = await sb
        .from('files')
        .insert({
          bucket: BUCKET,
          path,
          filename: fname,
          mime_type: mime,
          size_bytes: buf.length,
          doc_type: 'image',
          product_id: pid,
          finalized_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (fe) throw fe
      await sb.from('technical_products').update({ image_file_id: frow.id }).eq('id', pid)
      okI++
      if (okI % 25 === 0) console.log(`  … ${okI} ảnh`)
    } catch (err) {
      failI++
      console.error(`  ✗ ảnh ${fname}: ${err.message}`)
    }
  }
  console.log(`✓ Ảnh: ${okI} upload, ${skipI} đã có sẵn (bỏ qua), ${failI} lỗi`)
}

console.log('\nXONG.')
