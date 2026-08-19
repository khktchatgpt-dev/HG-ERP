// VÁ SỐ DẪN XUẤT CỦA ĐỊNH MỨC — cho 4.000 dòng đã nạp thẳng DB, không qua service.
//
//   node scripts/bom-derived-fix.mjs            # dò khô, in báo cáo
//   node scripts/bom-derived-fix.mjs --apply    # ghi
//   node scripts/bom-derived-fix.mjs --product HG-CH-001   # chỉ một SP
//
// VÌ SAO CẦN: `bom-import-all.mjs` ghi thẳng vào bảng, bỏ qua
// `technical.service.ts` — chỗ duy nhất gọi `calcPartDerived`. Hậu quả đo trên
// dữ liệu thật (19/08/2026):
//
//   · `material_kind` chỉ điền 3%  ⇒ thẻ "Tổng hợp vật tư" RỖNG ở 204/212 SP,
//     vì `PartsRollupCard` cộng kg theo hệ vật liệu.
//   · `total_length_m` 4% · `paint_area_m2` 3% · `volume_m3` 2%
//     ⇒ `columnsFor()` tự ẩn cột cả nhóm bỏ trống, nên bảng gỗ chỉ còn bốn cột
//       kích thước, không một con số kết quả.
//   · Cột "K. Lượng (m3)" của biểu mẫu GỖ bị luật tiêu đề `k. ?luong` của script
//     nạp bắt nhầm sang `weight_kg` ⇒ m³ nằm trong ô kg, mà layout `wood` không
//     có cột kg nên con số đó VÔ HÌNH. (Luật đã sửa cùng đợt này.)
//
// BA CHỐT AN TOÀN — số người nhập luôn thắng:
//  1. Chỉ điền ô ĐANG NULL. Không đè `weight_kg` người dùng/NCC đã ghi.
//  2. Ngoại lệ DUY NHẤT là ô kg đang chứa m³ (nhóm không có cột "Loại" và số
//     khớp thể tích hình học trong 2%) — chuyển sang `volume_m3`, giữ nguyên số
//     của file chứ không thay bằng số tính lại.
//  3. `material_kind` suy bằng cách GIẢI NGƯỢC khối lượng riêng từ chính
//     `weight_kg` đang có (kg ÷ (tiết diện × tổng dài) → 2700/7850/7930). Số này
//     tự nó là bằng chứng: sai hệ vật liệu thì tỉ trọng không rơi vào đâu cả.
//     Không giải được mới rơi về tiêu đề khối, rồi mới tới `base_material` của SP.

import { client } from './products-lib.mjs'
import { MATERIAL_DENSITY, calcPartDerived, crossSectionM2 } from '../src/lib/bom-calc.ts'

const APPLY = process.argv.includes('--apply')
const ONLY = (() => {
  const i = process.argv.indexOf('--product')
  return i > 0 ? process.argv[i + 1] : null
})()

const nod = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()

/** Nhóm hạng mục → họ khối. Giữ trùng khít `layoutOf` của part-layouts.ts. */
const layoutOf = (g) => {
  const t = String(g ?? '').toUpperCase()
  if (t === 'FRAME') return 'metal'
  if (t === 'WOOD') return 'wood'
  if (t === 'POLYWOOD' || t === 'PANEL') return 'sheet'
  if (t === 'CUSHION') return 'soft'
  if (t === 'FABRIC') return 'fabric'
  return 'supply'
}

/** Hệ vật liệu đọc từ chữ (tiêu đề khối hoặc ô "Vật liệu"). */
function kindFromText(text) {
  const t = nod(text)
  if (!t) return null
  if (/inox|stainless/.test(t)) return 'IN'
  if (/nhom|aluminium|aluminum/.test(t)) return 'AL'
  if (/\bsat\b|thep|la sat|steel|iron/.test(t)) return 'IR'
  if (/\bgo\b|go keo|go teck|teck|bach dan|van ep|polywood/.test(t)) return 'WD'
  if (/kinh|glass/.test(t)) return 'GL'
  if (/may|nhua dan|wicker|rattan/.test(t)) return 'RA'
  return null
}

/**
 * Giải ngược khối lượng riêng từ số kg đang có.
 *
 * Sắt 7850 và inox 7930 chỉ cách nhau 1%, hẹp hơn sai số làm tròn của bảng cân,
 * nên khi tỉ trọng rơi vào vùng đó thì KHÔNG tự chọn — trả `['IR','IN']` để lớp
 * trên phân giải bằng chữ. Nhôm 2700 thì cách xa, nhận thẳng.
 */
function kindFromDensity(p) {
  const area = crossSectionM2(
    p.profile_shape,
    p.dim_a_mm,
    p.dim_b_mm,
    p.wall_thickness_mm,
  )
  const len = p.cut_length_mm
  const qty = p.qty
  if (!area || !len || !qty || !p.weight_kg) return null
  const totalM = ((len + (p.bend_waste_mm ?? 0)) / 1000) * qty
  if (totalM <= 0) return null
  const rho = p.weight_kg / (area * totalM)
  const near = (target, tol) => Math.abs(rho - target) / target <= tol
  if (near(MATERIAL_DENSITY.AL, 0.05)) return ['AL']
  if (near(MATERIAL_DENSITY.IR, 0.05) || near(MATERIAL_DENSITY.IN, 0.05))
    return ['IR', 'IN']
  return null
}

async function all(sb, table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const sb = await client(import.meta.url)

const products = await all(sb, 'technical_products', 'id,code,name,base_material')
const byId = new Map(products.map((p) => [p.id, p]))
let parts = await all(sb, 'technical_product_parts', '*')
if (ONLY) {
  const prod = products.find((p) => p.code === ONLY)
  if (!prod) {
    console.error(`✗ không có SP mã ${ONLY}`)
    process.exit(1)
  }
  parts = parts.filter((p) => p.product_id === prod.id)
}

const stat = {
  kind: { density: 0, title: 0, base: 0, group: 0 },
  moved_m3: 0,
  cleared_kg: 0,
  no_wall: 0,
  fill: {
    total_length_m: 0,
    weight_kg: 0,
    paint_area_m2: 0,
    paint_area_box_m2: 0,
    volume_m3: 0,
  },
  deviate: [],
  untouched: 0,
}
const patches = []

for (const p of parts) {
  const patch = {}
  const layout = layoutOf(p.group_code)
  const prod = byId.get(p.product_id)

  /* ── 1. Hệ vật liệu ──────────────────────────────────────────────────── */
  let kind = p.material_kind
  if (!kind) {
    const fromText = kindFromText(p.section_title) ?? kindFromText(p.material_note)
    const cand = kindFromDensity(p)
    if (cand) {
      // Tỉ trọng khoanh vùng, chữ chọn trong vùng đó. Chữ nói "nhôm" mà cân ra
      // 7850 thì tin CÂN — số là số đo, chữ là tiêu đề chép từ mẫu SP khác.
      kind = cand.length === 1 ? cand[0] : cand.includes(fromText) ? fromText : 'IR'
      stat.kind.density++
    } else if (fromText) {
      kind = fromText
      stat.kind.title++
    } else if (layout === 'wood') {
      kind = 'WD'
      stat.kind.group++
    } else if (layout === 'metal' && prod?.base_material) {
      kind = prod.base_material
      stat.kind.base++
    }
    // `sheet` (kính/mặt đá/polywood), `soft` (nệm/mút/gòn) và `fabric` cố ý để
    // TRỐNG: MATERIAL_KIND_OPTIONS chưa có mã cho nệm/vải, gán bừa 'WD' cho tấm
    // kính là đặt sai thứ vào tay Cung ứng.
    if (kind) patch.material_kind = kind
  }

  const geo = { ...p, material_kind: kind }
  const d = calcPartDerived(geo)
  let keptKg = p.weight_kg

  /**
   * ỐNG RỖNG THIẾU δ — `crossSectionM2` coi hộp/tròn/vuông không khai độ dày
   * thành là ĐẶC. Đo trên dòng thật: hộp 25×50 dài 675 ×2 ra 4,556 kg nếu đặc,
   * còn 0,532 kg khi δ=1 — đúng số 0,525 file ghi. Tức số hình học ở đây sai
   * ~8,6 lần, không phải số người nhập sai. Nên: không điền kg cho những dòng
   * này, và cũng không đem chúng ra so lệch.
   */
  const hollowNoWall =
    ['HOP', 'TRON', 'VUONG'].includes(p.profile_shape) && p.wall_thickness_mm == null
  if (hollowNoWall) stat.no_wall++

  /* ── 2. Ô kg đang chứa m³ ────────────────────────────────────────────── */
  // CHỈ xét nhóm gỗ · nệm · vải · tấm. `calcPartDerived` nhận diện "khối đặc"
  // bằng `!profile_shape`, mà dòng KHUNG dùng mã khuôn (TD-B629, Oval B570)
  // cũng bỏ trống ô Loại ⇒ nếu không chặn theo họ khối thì thanh nhôm định
  // hình bị đem ra so với thể tích khối chữ nhật.
  const solidFamily = layout !== 'metal' && layout !== 'supply'

  if (solidFamily && p.weight_kg != null && d.volume_m3 != null) {
    const off = Math.abs(p.weight_kg - d.volume_m3) / d.volume_m3
    if (off <= 0.02) {
      if (p.volume_m3 == null) {
        patch.volume_m3 = p.weight_kg // giữ số của file, không thay bằng số tính lại
        stat.moved_m3++
      }
      patch.weight_kg = null
      keptKg = null
      stat.cleared_kg++
    }
  }

  /* ── 3. Điền ô còn trống ─────────────────────────────────────────────── */
  for (const k of [
    'total_length_m',
    'weight_kg',
    'paint_area_m2',
    'paint_area_box_m2',
    'volume_m3',
  ]) {
    if (k === 'weight_kg' && hollowNoWall) continue
    if (k === 'volume_m3' && !solidFamily) continue // m³ của thanh nhôm là số vô nghĩa
    const cur = k === 'weight_kg' ? keptKg : (patch[k] ?? p[k])
    if (cur == null && d[k] != null) {
      patch[k] = d[k]
      stat.fill[k]++
    }
  }

  /* ── 4. Số người nhập lệch hình học — chỉ BÁO, không sửa ─────────────── */
  if (!hollowNoWall && keptKg != null && d.weight_kg != null) {
    const off = Math.abs(keptKg - d.weight_kg) / d.weight_kg
    if (off > 0.15)
      stat.deviate.push({
        code: prod?.code ?? '?',
        name: p.part_name,
        entered: keptKg,
        computed: d.weight_kg,
        off,
      })
  }

  if (Object.keys(patch).length) patches.push({ id: p.id, patch })
  else stat.untouched++
}

/* ── Báo cáo ────────────────────────────────────────────────────────────── */
const pct = (n) => `${((100 * n) / parts.length).toFixed(0)}%`
console.log(
  `\nDòng định mức xét: ${parts.length}  ·  sẽ sửa: ${patches.length}  ·  giữ nguyên: ${stat.untouched}\n`,
)

console.log('Hệ vật liệu (material_kind) suy được:')
console.log(`  · giải ngược từ khối lượng đang có : ${stat.kind.density}`)
console.log(`  · đọc từ tiêu đề khối / ô vật liệu : ${stat.kind.title}`)
console.log(`  · theo nhóm (gỗ)                   : ${stat.kind.group}`)
console.log(`  · theo "Nhiên Liệu" của hồ sơ SP   : ${stat.kind.base}`)
const kindTotal = Object.values(stat.kind).reduce((a, b) => a + b, 0)
console.log(`  ⇒ tổng ${kindTotal} dòng (${pct(kindTotal)})\n`)

console.log('Ô kg đang chứa m³:')
console.log(`  · chuyển sang volume_m3 : ${stat.moved_m3}`)
console.log(`  · xoá khỏi weight_kg    : ${stat.cleared_kg}\n`)

console.log('Điền ô đang trống:')
for (const [k, v] of Object.entries(stat.fill))
  console.log(`  · ${k.padEnd(18)} : ${v} (${pct(v)})`)

console.log(
  `\nỐng rỗng THIẾU δ (dày vật liệu): ${stat.no_wall} dòng (${pct(stat.no_wall)})` +
    '\n  → không tính được kg (coi là đặc thì sai ~8 lần). Kỹ thuật phải bổ sung δ,' +
    '\n    hoặc gắn mã khuôn để lấy kg/m từ danh mục. Script KHÔNG đoán hộ.',
)

if (stat.deviate.length) {
  console.log(
    `\nKhối lượng người nhập lệch hình học > 15% (đã đủ δ) — GIỮ NGUYÊN, chỉ báo (${stat.deviate.length} dòng):`,
  )
  for (const d of stat.deviate.slice(0, 12))
    console.log(
      `  ${d.code.padEnd(12)} ${String(d.name).slice(0, 28).padEnd(30)} nhập ${d.entered.toFixed(3)} · hình học ${d.computed.toFixed(3)} · lệch ${(100 * d.off).toFixed(0)}%`,
    )
  if (stat.deviate.length > 12) console.log(`  … còn ${stat.deviate.length - 12} dòng`)
}

/* Thẻ "Tổng hợp vật tư" sau khi vá — chính là thứ Cung ứng đọc. */
const after = new Map(
  parts.map((p) => [
    p.id,
    { ...p, ...(patches.find((x) => x.id === p.id)?.patch ?? {}) },
  ]),
)
const byProduct = new Map()
for (const p of after.values()) {
  if (!byProduct.has(p.product_id)) byProduct.set(p.product_id, [])
  byProduct.get(p.product_id).push(p)
}
const rollupLines = (rows) => {
  const n = new Set()
  for (const p of rows) {
    if (p.weight_kg != null && p.material_kind && MATERIAL_DENSITY[p.material_kind])
      n.add(`kg:${p.material_kind}`)
    if (layoutOf(p.group_code) === 'metal' && p.paint_area_m2) n.add('son')
    if (layoutOf(p.group_code) !== 'metal' && p.paint_area_m2) n.add('vai')
    if (layoutOf(p.group_code) !== 'metal' && p.volume_m3) n.add('m3')
  }
  return n.size
}
const before = new Map()
for (const p of parts) {
  if (!before.has(p.product_id)) before.set(p.product_id, [])
  before.get(p.product_id).push(p)
}
const emptyBefore = [...before.values()].filter((r) => rollupLines(r) === 0).length
const emptyAfter = [...byProduct.values()].filter((r) => rollupLines(r) === 0).length
console.log(
  `\nThẻ "Tổng hợp vật tư" rỗng: ${emptyBefore}/${before.size} SP  →  ${emptyAfter}/${byProduct.size} SP`,
)

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

/* ── Ghi ────────────────────────────────────────────────────────────────── */
let done = 0
for (const { id, patch } of patches) {
  const { error } = await sb.from('technical_product_parts').update(patch).eq('id', id)
  if (error) {
    console.error(`✗ ${id}: ${error.message}`)
    process.exit(1)
  }
  if (++done % 250 === 0) console.log(`  … ${done}/${patches.length}`)
}
console.log(`✓ đã ghi ${done} dòng`)
