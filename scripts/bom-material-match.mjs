// GẮN MÃ VẬT TƯ KHO cho các dòng định mức đã nạp từ file BOM.
//
//   node scripts/bom-material-match.mjs            # dò khô
//   node scripts/bom-material-match.mjs --apply    # ghi thật
//   node scripts/bom-material-match.mjs --group NGU_KIM
//
// Vì sao cần: file BOM gốc KHÔNG có cột mã vật tư kho, chỉ có tên và quy cách.
// Mà `v_lsx_material_status` nối định mức với kho bằng đúng mã đó — thiếu mã
// thì 3.993 dòng định mức vẫn không ra được một dòng nhu cầu nào cho Cung ứng.
//
// Khớp bằng ĐÚNG bộ khoá mà server dùng để chặn trùng khi tạo vật tư
// (`src/lib/material-key.ts`) — chỗ chặn và chỗ dò phải hiểu "trùng" giống nhau:
//   · CHẮC  — `sureKey` trùng và chỉ có 1 ứng viên  → gắn thẳng
//   · MỜ    — `namesAlike` và chỉ có 1 ứng viên     → gắn, có đánh dấu để rà
//   · còn lại                                       → để trống, in ra
//
// Hai lối dựng tên đem đi khớp, tuỳ nhóm:
//   · Nhóm MUA RỜI (ngũ kim · bao bì · tem · dây kéo): `part_name` CHÍNH LÀ tên
//     hàng ("Bulong M6 x 25") → khớp thẳng.
//   · Nhóm GIA CÔNG (khung · gỗ · polywood): `part_name` là tên chi tiết
//     ("Chân sau") chứ không phải vật tư. Phải dựng lại tên vật tư từ vật liệu +
//     hình dạng + tiết diện: "nhôm hộp 40x40x1li".

import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { client } from './products-lib.mjs'
import { sureKey, namesAlike, nod, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const require = createRequire(import.meta.url)
void require

const APPLY = process.argv.includes('--apply')
const onlyGroup = (() => {
  const i = process.argv.indexOf('--group')
  return i >= 0 ? process.argv[i + 1] : null
})()
const SCRATCH =
  'C:/Users/HP/AppData/Local/Temp/claude/D--HG-ERP/898a80db-19d7-4257-bd66-16d2d0ebc235/scratchpad'

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

/* ── Danh mục kho ────────────────────────────────────────────────────────── */
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

/**
 * RỔ ỨNG VIÊN cho bước khớp mờ. `namesAlike` chỉ trả true khi hai tên có CÙNG SỐ
 * TỪ và mọi từ mang chữ số phải khớp tuyệt đối — nên chỉ cần so trong rổ
 * "số từ | bộ số". Quét thẳng 13.168 vật tư cho mỗi dòng là 52 triệu phép so,
 * chạy quá 10 phút chưa xong; có rổ thì mỗi dòng chỉ còn vài ứng viên.
 */
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
  if (k.length < MIN_KEY_LEN) return null
  const sure = matByKey.get(k)
  if (sure?.length === 1) return { code: sure[0].code, name: sure[0].name, how: 'chắc' }
  if (sure?.length > 1) return null // trùng chéo trong danh mục — để người rà
  const b = bucketKey(name)
  const pool = b ? (matByBucket.get(b) ?? []) : []
  const alike = pool.filter((m) => namesAlike(name, m.name))
  if (alike.length === 1) return { code: alike[0].code, name: alike[0].name, how: 'mờ' }
  return null
}

/* ── Dựng tên vật tư cho nhóm GIA CÔNG ───────────────────────────────────── */
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
const numTxt = (v) => (Number.isInteger(v) ? String(v) : String(v).replace('.', '.'))

/**
 * "nhôm hộp 40x40x1li" · "inox tròn 19x0.8li" · "gỗ keo".
 * Tròn/vuông tiết diện đều nên chỉ nêu MỘT chiều — danh mục kho cũng viết vậy
 * ("Nhôm vuông 40x1li"), ghi "40x40" là không khớp được với mã nào.
 */
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

/** Gỗ: loại gỗ nằm ở tiêu đề khối ("Quy cách Gỗ: Gỗ Teck") hoặc cột vật liệu. */
function woodName(p) {
  const src = `${p.wood_species ?? ''} ${p.material_note ?? ''} ${p.section_title ?? ''}`
  const m = src.match(/g[ỗo]\s*(teck|teak|keo|b[ạa]ch\s*đ[àa]n|tr[àa]m|cao\s*su)/i)
  if (m) return `gỗ ${m[1]}`
  if (/polywood|ván ép|van ep/i.test(src)) return 'polywood'
  return null
}

const SUPPLY_GROUPS = new Set([
  'NGU_KIM',
  'HARDWARE',
  'PACKAGING',
  'LABEL',
  'ZIPPER',
  'DAY_DAN',
  'SON_HC',
])

/* ── Dòng định mức chưa có mã ────────────────────────────────────────────── */
const parts = await allRows(
  'technical_product_parts',
  'id, product_id, group_code, part_name, material_note, section_title, profile_shape, material_kind, dim_a_mm, dim_b_mm, wall_thickness_mm, wood_species',
  (q) => q.is('material_code', null),
)
const products = await allRows('technical_products', 'id, base_material')
const baseOf = new Map(products.map((p) => [p.id, p.base_material]))

const hits = []
const misses = []
for (const p of parts) {
  if (onlyGroup && p.group_code !== onlyGroup) continue
  let probe = null
  if (SUPPLY_GROUPS.has(p.group_code)) {
    // Tên hàng có thể bị tách làm hai cột lúc nạp cũ — ghép lại rồi mới khớp.
    probe = [p.part_name, p.material_note].filter(Boolean).join(' ').trim()
  } else if (p.group_code === 'FRAME') {
    probe = frameName(p, baseOf.get(p.product_id))
  } else if (p.group_code === 'WOOD' || p.group_code === 'POLYWOOD') {
    probe = woodName(p)
  }
  if (!probe) {
    misses.push({ ...p, probe: '(không dựng được tên)' })
    continue
  }
  // Chỉ nhóm MUA RỜI mới được thử lại bằng `part_name`: ở đó part_name chính là
  // tên hàng. Với khung/gỗ, part_name là tên CHI TIẾT ("Chân sau") — đem đi khớp
  // danh mục kho là mời gọi gán bừa.
  let hit = matchName(probe)
  let via = probe
  if (!hit && SUPPLY_GROUPS.has(p.group_code) && probe !== p.part_name) {
    hit = matchName(p.part_name)
    if (hit) via = p.part_name
  }
  if (hit) hits.push({ part: p, probe, via, ...hit })
  else misses.push({ ...p, probe })
}

const byHow = new Map()
const byGroup = new Map()
for (const h of hits) {
  byHow.set(h.how, (byHow.get(h.how) ?? 0) + 1)
  byGroup.set(h.part.group_code, (byGroup.get(h.part.group_code) ?? 0) + 1)
}
console.log(`\n=== GẮN MÃ VẬT TƯ ===`)
console.log(`Dòng chưa có mã : ${parts.length}`)
console.log(
  `Khớp được       : ${hits.length}  (${[...byHow].map(([k, n]) => `${k} ${n}`).join(' · ')})`,
)
console.log(`Chưa khớp       : ${misses.length}`)
console.log(`\nKhớp theo nhóm:`)
for (const [g, n] of [...byGroup].sort((a, b) => b[1] - a[1]))
  console.log(`  ${g.padEnd(10)} ${n}`)

writeFileSync(
  `${SCRATCH}/mat-hits.txt`,
  hits
    .map((h) => [h.how, h.part.group_code, h.probe, '→', h.code, h.name].join('\t'))
    .join('\n'),
  'utf8',
)
writeFileSync(
  `${SCRATCH}/mat-misses.txt`,
  misses.map((m) => [m.group_code, m.part_name, m.probe].join('\t')).join('\n'),
  'utf8',
)

if (!APPLY) {
  console.log(`\nDò khô — chưa ghi gì. Thêm --apply để gắn.\n`)
  process.exit(0)
}

const sure = hits.filter((h) => h.how === 'chắc')
const fuzzy = hits.filter((h) => h.how !== 'chắc')
// Mức MỜ KHÔNG tự ghi: `namesAlike` chỉ để cảnh báo, gán bừa một mã sai là
// Cung ứng mua nhầm vật tư mà không ai thấy. Xuất ra cho người rà rồi gắn tay.
writeFileSync(
  `${SCRATCH}/mat-fuzzy.txt`,
  fuzzy.map((h) => [h.part.group_code, h.via, '→', h.code, h.name].join('\t')).join('\n'),
  'utf8',
)
console.log(`Ghi mức CHẮC: ${sure.length} · để rà mức MỜ: ${fuzzy.length}`)
let done = 0
for (const h of sure) {
  const { error } = await db
    .from('technical_product_parts')
    .update({ material_code: h.code })
    .eq('id', h.part.id)
  if (error) {
    console.error(`  ✗ ${h.part.part_name}: ${error.message}`)
    continue
  }
  done++
  if (done % 200 === 0) console.log(`  … ${done}/${sure.length}`)
}
console.log(`\nĐÃ GẮN ${done} dòng.\n`)
