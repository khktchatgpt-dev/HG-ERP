/**
 * Nạp file BOM theo biểu mẫu mới ("BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN") vào hệ.
 *
 *   node scripts/seed-bom-sample.mjs "<đường dẫn .xlsx>" <MÃ SP>
 *
 * Đây là BẢN THỬ của bộ đọc file BOM (lộ trình §4.4) — dùng để kiểm chứng cấu
 * trúc 0097 bằng dữ liệu thật, chưa phải đường nhập chính thức cho người dùng.
 *
 * Đọc GIÁ TRỊ đã tính của công thức Excel để so, nhưng số ghi xuống DB là số
 * TÍNH LẠI bằng `bom-calc` — đúng nguyên tắc "mọi đại lượng dẫn xuất là số tính
 * ra". Chênh lệch nào >1% sẽ được in ra để soi.
 */
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import { calcPartDerived, parseShape } from '../src/lib/bom-calc.ts'

const [file, code] = process.argv.slice(2)
if (!file || !code) {
  console.error('Cần: node scripts/seed-bom-sample.mjs "<file.xlsx>" <MÃ SP>')
  process.exit(1)
}

const env = readFileSync('.env.local', 'utf8')
for (const line of env.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false } },
)

const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(file)
const ws = wb.getWorksheet('BOM')

/** Giá trị ô: công thức thì lấy KẾT QUẢ, rich text thì lấy chữ. */
const cell = (r, c) => {
  let v = ws.getRow(r).getCell(c).value
  if (v && typeof v === 'object') {
    if (v.richText) v = v.richText.map((t) => t.text).join('')
    else if ('result' in v) v = v.result
    else if (v.text) v = v.text
    else v = null
  }
  return v === '' ? null : v
}
const txt = (r, c) => {
  const v = cell(r, c)
  return v == null ? null : String(v).trim() || null
}
const num = (r, c) => {
  const v = cell(r, c)
  // Ô rỗng phải ra null, KHÔNG phải 0: `Number('')` là 0 và số 0 đó chảy thẳng
  // vào STT, mộng, δ — hiện ra bảng thành "0" ở khắp nơi thay vì để trống.
  if (v == null || v === '') return null
  const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  return Number.isFinite(x) ? x : null
}

// ── 1. Nhận diện các KHỐI qua dải tiêu đề ở cột A ────────────────────────────
const MARKERS = [
  { re: /^quy cách\s*:/i, group: 'FRAME', layout: 'metal' },
  { re: /^quy cách gỗ/i, group: 'WOOD', layout: 'wood' },
  { re: /^quy cách nệm/i, group: 'CUSHION', layout: 'soft' },
  { re: /^vật tư ngũ kim/i, group: 'NGU_KIM', layout: 'supply' },
  { re: /^vật tư bao bì/i, group: 'PACKAGING', layout: 'supply' },
]

const blocks = []
for (let r = 1; r <= ws.rowCount; r++) {
  const a = txt(r, 1)
  if (!a) continue
  const hit = MARKERS.find((m) => m.re.test(a))
  if (hit) blocks.push({ ...hit, title: a, from: r + 1, to: ws.rowCount })
}
for (let i = 0; i < blocks.length - 1; i++) blocks[i].to = blocks[i + 1].from - 2
if (!blocks.length) throw new Error('Không thấy khối nào — file có đúng biểu mẫu mới?')

// Ô "Nhiên Liệu" (K11) quyết định tỉ trọng của cả khối khung.
const fuel = (txt(11, 11) ?? '').toLowerCase()
const baseMaterial = fuel.includes('nhôm')
  ? 'AL'
  : fuel.includes('inox')
    ? 'IN'
    : fuel.includes('sắt')
      ? 'IR'
      : null

/**
 * Bảng tra kg/m của profile không tính được bằng hình học. Biểu mẫu để nó ở ô
 * chú thích bên phải bảng khung, dạng `"TD-HG04 / 0.260"` (thanh 12 × 24).
 */
const kgPerM = new Map()
for (let r = 15; r <= 25; r++) {
  for (let c = 17; c <= 24; c++) {
    const m = /^([A-Za-z0-9-]+)\s*\/\s*([\d.,]+)$/.exec(txt(r, c) ?? '')
    if (m) kgPerM.set(m[1].toUpperCase(), Number(m[2].replace(',', '.')))
  }
}

const productName = txt(8, 8) ?? code
const customer = txt(8, 14)
const ktsp = txt(10, 8)

// ── 2. Đọc dòng của từng khối ────────────────────────────────────────────────
const STOP = /^(tổng cộng|tổng)/i
const rows = []
const clusterNames = []
const skipped = []

for (const b of blocks) {
  for (let r = b.from; r <= b.to; r++) {
    const name = txt(r, 3)
    if (!name) continue
    if (STOP.test(name)) break
    // Khối CUỐI chạy tới hết sheet nên nuốt luôn khối tổng hợp phía dưới — mà
    // khối đó đặt tên hàng ở cột B, cột C là "ĐVT". Dòng định mức thật LUÔN có
    // số lượng, nên đó là dấu hiệu phân biệt chắc nhất. Bỏ qua nhưng có ghi lại,
    // không nuốt im lặng.
    if (!(num(r, 9) > 0)) {
      skipped.push(`dòng ${r}: "${name}" (không có SL)`)
      continue
    }

    if (b.layout === 'metal') {
      const loai = txt(r, 4)
      const shape = parseShape(loai)
      const cluster = txt(r, 2)
      if (cluster && !clusterNames.includes(cluster)) clusterNames.push(cluster)
      rows.push({
        block: b,
        cluster,
        part_no: num(r, 1),
        part_name: name,
        // "Loại" không nhận ra dạng nào (TD-HG04) = mã profile tra bảng kg/m.
        profile_shape: shape,
        profile_code: shape ? null : loai,
        kg_per_m: shape ? null : (kgPerM.get((loai ?? '').toUpperCase()) ?? null),
        material_kind: baseMaterial,
        dim_a_mm: num(r, 5),
        dim_b_mm: num(r, 6),
        cut_length_mm: num(r, 7),
        bend_waste_mm: num(r, 8),
        qty: num(r, 9),
        wall_thickness_mm: num(r, 13),
        note: txt(r, 14),
        xlsx: { len: num(r, 10), kg: num(r, 11), m2: num(r, 12) },
      })
    } else if (b.layout === 'wood' || b.layout === 'soft') {
      rows.push({
        block: b,
        cluster: null,
        part_no: num(r, 1),
        part_name: name,
        dim_a_mm: num(r, 4),
        dim_b_mm: num(r, 5),
        cut_length_mm: num(r, 6),
        tenon_mm: num(r, 7),
        qty: num(r, 9),
        note: txt(r, 12),
        xlsx: { m2: num(r, 10), m3: num(r, 11) },
      })
    } else {
      rows.push({
        block: b,
        cluster: null,
        part_no: num(r, 1),
        part_name: name,
        dim_a_mm: num(r, 4),
        dim_b_mm: num(r, 5),
        cut_length_mm: num(r, 6),
        qty: num(r, 9),
        unit: txt(r, 8),
        material_note: txt(r, 10),
        note: txt(r, 12),
        xlsx: {},
      })
    }
  }
}

// ── 3. Ghi vào DB ────────────────────────────────────────────────────────────
const { data: product, error: pErr } = await sb
  .from('technical_products')
  .upsert(
    {
      code,
      name: productName,
      customer_name: customer,
      unit: 'cai',
      base_material: baseMaterial,
      paint_coverage_m2_per_kg: 5,
      bom_rev: num(2, 14),
      bom_prepared_by: txt(3, 6),
      bom_status: 'drawing',
      notes: ktsp ? `KTSP (WxDxH mm): ${ktsp}` : null,
    },
    { onConflict: 'code' },
  )
  .select('id, code')
  .single()
if (pErr) throw new Error(`SP: ${pErr.message}`)

await sb.from('technical_product_parts').delete().eq('product_id', product.id)
await sb.from('technical_product_clusters').delete().eq('product_id', product.id)

const clusterId = new Map()
for (const [i, name] of clusterNames.entries()) {
  const { data, error } = await sb
    .from('technical_product_clusters')
    .insert({
      product_id: product.id,
      name,
      first_stage: 'han',
      final_stage: 'son',
      sort_order: i + 1,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Cụm ${name}: ${error.message}`)
  clusterId.set(name, data.id)
}

const warn = []
const payload = rows.map((r, i) => {
  const d = calcPartDerived(r)
  // So số TÍNH với số ĐÃ TÍNH SẴN trong file — lệch nhiều là dấu hiệu đọc sai cột.
  const chk = (label, got, want) => {
    if (want == null || got == null || want === 0) return
    const off = Math.abs(got - want) / Math.abs(want)
    if (off > 0.01)
      warn.push(
        `${r.part_name} · ${label}: tính ${got.toFixed(4)} vs file ${want} (${(off * 100).toFixed(1)}%)`,
      )
  }
  chk('tổng dài', d.total_length_m, r.xlsx.len)
  chk('kg', d.weight_kg, r.xlsx.kg)
  chk('DT (theo file)', d.paint_area_box_m2, r.xlsx.m2)
  chk('m³', d.volume_m3, r.xlsx.m3)

  return {
    product_id: product.id,
    group_code: r.block.group,
    section_title: r.block.title,
    cluster_id: r.cluster ? clusterId.get(r.cluster) : null,
    part_no: r.part_no,
    part_name: r.part_name,
    profile_shape: r.profile_shape ?? null,
    profile_code: r.profile_code ?? null,
    material_kind: r.material_kind ?? null,
    material_note: r.material_note ?? null,
    dim_a_mm: r.dim_a_mm,
    dim_b_mm: r.dim_b_mm,
    wall_thickness_mm: r.wall_thickness_mm ?? null,
    cut_length_mm: r.cut_length_mm,
    kg_per_m: r.kg_per_m ?? null,
    bend_waste_mm: r.bend_waste_mm ?? null,
    tenon_mm: r.tenon_mm ?? null,
    qty: r.qty ?? 1,
    unit: r.unit ?? null,
    note: r.note,
    total_length_m: d.total_length_m,
    weight_kg: d.weight_kg,
    paint_area_m2: d.paint_area_m2,
    paint_area_box_m2: d.paint_area_box_m2,
    volume_m3: d.volume_m3,
    sort_order: i + 1,
  }
})

const { error: iErr } = await sb.from('technical_product_parts').insert(payload)
if (iErr) throw new Error(`Dòng định mức: ${iErr.message}`)

console.log(`SP    : ${product.code} — ${productName}${customer ? ` (${customer})` : ''}`)
console.log(`Khối  : ${blocks.map((b) => `${b.title} [${b.group}]`).join(' · ')}`)
console.log(
  `Cụm   : ${clusterNames.length ? clusterNames.join(' · ') : '(không có — tất cả là dòng Rời)'}`,
)
console.log(`Dòng  : ${payload.length}`)
console.log(`Rời   : ${payload.filter((p) => !p.cluster_id).length}`)
console.log(
  `Tổng  : ${payload.reduce((s, p) => s + (p.weight_kg ?? 0), 0).toFixed(4)} kg · ` +
    `${payload.reduce((s, p) => s + (p.paint_area_m2 ?? 0), 0).toFixed(4)} m² sơn (chu vi thật) · ` +
    `${payload.reduce((s, p) => s + (p.volume_m3 ?? 0), 0).toFixed(6)} m³`,
)
console.log(
  warn.length
    ? `\nLỆCH so với file (${warn.length}):\n  ${warn.join('\n  ')}`
    : '\nKhớp mọi ô đã tính sẵn trong file.',
)
