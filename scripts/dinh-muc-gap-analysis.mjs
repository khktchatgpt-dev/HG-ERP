// PHÂN TÍCH 3.345 DÒNG ĐỊNH MỨC CHƯA GẮN MÃ KHO — chia rổ, KHÔNG ghi gì.
//
//   node scripts/dinh-muc-gap-analysis.mjs
//
// Trả lời câu "có nên thêm hết vào kho không?" (user 13/08/2026): tách
//   · rổ NGUYÊN LIỆU (khung/gỗ/tấm): gộp theo TỔ HỢP tiết diện — cái nào khớp
//     mã kho có sẵn (auto gắn được cả cụm), cái nào kho thật sự thiếu;
//   · rổ MUA RỜI (ngũ kim/bao bì/tem): tên nào khớp / gần khớp / là ỨNG VIÊN
//     MÃ MỚI cho Kho duyệt (không tự tạo — bài học materials-dedupe);
//   · rổ CHỜ NGHIỆP VỤ (nệm/vải/kính…): liệt kê cho user chốt mua-hay-gia-công.
//
// Bộ dựng tên + khớp dùng CHUNG với bom-material-match.mjs — hai script phải
// hiểu "khớp" giống nhau, không thì số phân tích và số gắn thật lệch nhau.

import { writeFileSync } from 'node:fs'
import { client } from './products-lib.mjs'
import { sureKey, namesAlike, nod, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const db = await client(import.meta.url)

async function allRows(table, cols, filter) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = db
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

/* ── Danh mục + rổ khớp (chép đúng bom-material-match) ───────────────────── */
const mats = await allRows('warehouse_materials', 'id, code, name', (q) =>
  q.eq('is_active', true),
)
const matByKey = new Map()
for (const m of mats) {
  const k = sureKey(m.name)
  if (k.length < MIN_KEY_LEN) continue
  if (!matByKey.has(k)) matByKey.set(k, [])
  matByKey.get(k).push(m)
}
const tokensOf = (name) =>
  nod(name)
    .replace(/[^a-z0-9⁄]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((t) => t && t !== 'mau')
const bucketKey = (name) => {
  const t = tokensOf(name)
  if (t.length === 0) return null
  const nums = t
    .filter((x) => /\d/.test(x))
    .sort()
    .join(',')
  return `${t.length}|${nums}`
}
const matByBucket = new Map()
for (const m of mats) {
  const b = bucketKey(m.name)
  if (!b) continue
  if (!matByBucket.has(b)) matByBucket.set(b, [])
  matByBucket.get(b).push(m)
}
function matchName(name) {
  const k = sureKey(name)
  if (k.length < MIN_KEY_LEN) return { how: 'ten-ngan' }
  const sure = matByKey.get(k)
  if (sure?.length === 1) return { how: 'chắc', ...sure[0] }
  if (sure?.length > 1) return { how: 'trùng-chéo', codes: sure.map((x) => x.code) }
  const pool = bucketKey(name) ? (matByBucket.get(bucketKey(name)) ?? []) : []
  const alike = pool.filter((m) => namesAlike(name, m.name))
  if (alike.length === 1) return { how: 'mờ', ...alike[0] }
  if (alike.length > 1) return { how: 'mờ-nhiều', codes: alike.map((x) => x.code) }
  return { how: 'không' }
}

/* ── Dựng tên (chép đúng bom-material-match) ─────────────────────────────── */
const MAT_WORD = { AL: 'nhôm', IR: 'sắt', IN: 'inox', WD: 'gỗ', RA: 'mây', GL: 'kính' }
const SHAPE_WORD = {
  HOP: 'hộp',
  TRON: 'tròn',
  TRONDAC: 'tròn đặc',
  VUONG: 'vuông',
  LA: 'la',
  OVAN: 'ovan',
  TAM: 'tấm',
  LUOI: 'lưới',
}
const nz = (v) => (v == null ? null : Number(v))
const numTxt = (v) => String(v)
function frameName(p, baseMaterial) {
  const mat = MAT_WORD[p.material_kind ?? baseMaterial ?? ''] ?? ''
  const shape = SHAPE_WORD[p.profile_shape ?? ''] ?? ''
  const a = nz(p.dim_a_mm)
  const b = nz(p.dim_b_mm)
  const wall = nz(p.wall_thickness_mm)
  if (!mat && !shape) return null
  let dims = ''
  if (a != null) {
    const oneDim =
      p.profile_shape === 'TRON' ||
      p.profile_shape === 'TRONDAC' ||
      p.profile_shape === 'VUONG'
    dims = oneDim || b == null || b === a ? numTxt(a) : `${numTxt(a)}x${numTxt(b)}`
  }
  const w = wall != null ? `${numTxt(wall)}li` : ''
  return [mat, shape, [dims, w].filter(Boolean).join('x')]
    .filter(Boolean)
    .join(' ')
    .trim()
}
function woodName(p) {
  const src = `${p.wood_species ?? ''} ${p.material_note ?? ''} ${p.section_title ?? ''}`
  const m = src.match(/g[ỗo]\s*(teck|teak|keo|b[ạa]ch\s*đ[àa]n|tr[àa]m|cao\s*su)/i)
  if (m) return `gỗ ${m[1]}`
  if (/polywood|ván ép|van ep/i.test(src)) return 'polywood'
  return null
}

const SUPPLY = new Set(['NGU_KIM', 'HARDWARE', 'PACKAGING', 'LABEL', 'ZIPPER'])
const RAW = new Set(['FRAME', 'WOOD', 'POLYWOOD', 'PANEL'])

/* ── Dòng trống mã ───────────────────────────────────────────────────────── */
const parts = await allRows(
  'technical_product_parts',
  'id, product_id, group_code, part_name, material_note, section_title, profile_shape, material_kind, dim_a_mm, dim_b_mm, wall_thickness_mm, wood_species',
  (q) => q.is('material_code', null),
)
const products = await allRows('technical_products', 'id, base_material')
const baseOf = new Map(products.map((p) => [p.id, p.base_material]))

/** identity → { group, name, lines, products:Set, match } */
const agg = new Map()
let noIdentity = 0
for (const p of parts) {
  let name = null
  if (SUPPLY.has(p.group_code)) {
    name = [p.part_name, p.material_note].filter(Boolean).join(' ').trim() || null
  } else if (p.group_code === 'FRAME') {
    name = frameName(p, baseOf.get(p.product_id))
  } else if (p.group_code === 'WOOD' || p.group_code === 'POLYWOOD') {
    name = woodName(p) ?? null
  } else {
    // CUSHION / FABRIC / PANEL…: nhận diện bằng vật liệu ghi trên dòng.
    name = (p.material_note || p.section_title || '').trim() || null
  }
  if (!name) {
    noIdentity++
    continue
  }
  const key = `${p.group_code}|${nod(name)}`
  const cur = agg.get(key) ?? {
    group: p.group_code,
    name,
    lines: 0,
    products: new Set(),
  }
  cur.lines++
  cur.products.add(p.product_id)
  agg.set(key, cur)
}
for (const e of agg.values()) {
  e.match = matchName(e.name)
  // Cùng biến thể 'tròn'→'phi' với bom-material-match (13/08) — hai script
  // phải hiểu "khớp" giống nhau.
  if (e.match.how === 'không' && e.name.includes('tròn')) {
    const alt = matchName(e.name.replace('tròn', 'phi'))
    if (alt.how !== 'không') e.match = alt
  }
}

/* ── Báo cáo ─────────────────────────────────────────────────────────────── */
const rows = [...agg.values()].sort((a, b) => b.lines - a.lines)
const by = (pred) => rows.filter(pred)
const sumLines = (rs) => rs.reduce((s, r) => s + r.lines, 0)

const rawRows = by((r) => RAW.has(r.group))
const supplyRows = by((r) => SUPPLY.has(r.group))
const otherRows = by((r) => !RAW.has(r.group) && !SUPPLY.has(r.group))

function statusSplit(rs) {
  const out = {}
  for (const r of rs) {
    out[r.match.how] = out[r.match.how] ?? { items: 0, lines: 0 }
    out[r.match.how].items++
    out[r.match.how].lines += r.lines
  }
  return out
}

console.log(`Dòng trống mã: ${parts.length} · không dựng được danh tính: ${noIdentity}`)
console.log(`Tổ hợp riêng biệt: ${agg.size}\n`)
for (const [label, rs] of [
  ['NGUYÊN LIỆU (khung/gỗ/tấm) — map, KHÔNG tạo mã mới', rawRows],
  ['MUA RỜI (ngũ kim/bao bì/tem) — ứng viên mã mới có duyệt', supplyRows],
  ['CHỜ NGHIỆP VỤ (nệm/vải…)', otherRows],
]) {
  console.log(`== ${label}: ${rs.length} tổ hợp / ${sumLines(rs)} dòng`)
  for (const [how, v] of Object.entries(statusSplit(rs))) {
    console.log(`   ${how}: ${v.items} tổ hợp / ${v.lines} dòng`)
  }
}

const line = (r) =>
  `${r.group}\t${r.name}\t${r.lines} dòng / ${r.products.size} SP\t${r.match.how}${r.match.code ? `\t${r.match.code} — ${r.match.name}` : ''}${r.match.codes ? `\t[${r.match.codes.join(', ')}]` : ''}`

const SCRATCH =
  'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/c2e401d8-36d0-42ea-8ce4-78582749e651/scratchpad'
writeFileSync(
  `${SCRATCH}/dinh-muc-gap-report.tsv`,
  ['nhóm\tdanh tính\tphủ\tkhớp\tmã', ...rows.map(line)].join('\n'),
)
console.log(`\nChi tiết: ${SCRATCH}/dinh-muc-gap-report.tsv`)

console.log(`\n-- TOP 25 tổ hợp phủ nhiều dòng nhất --`)
for (const r of rows.slice(0, 25)) console.log('  ' + line(r))
