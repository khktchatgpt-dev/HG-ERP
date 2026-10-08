/**
 * THAY TOÀN BỘ DANH MỤC KHUÔN NHÔM bằng dữ liệu fs_profile của app CodeIgniter cũ
 * (09/10/2026, chủ dự án: "thêm lên danh sách khuôn nhôm từ file tôi gửi, xoá toàn
 * bộ khuôn nhôm hiện tại").
 *
 * Nguồn: `backups/fs_profile-from-debugbar-1008.json` (144 dòng bóc từ app cũ) +
 * ảnh mặt cắt ở `D:/New folder/Hoanggia/uploads/profiles/<image>`.
 *
 *   node scripts/khuon-thay-fs-profile-1009.mjs            → dò khô, in bảng đối chiếu
 *   node scripts/khuon-thay-fs-profile-1009.mjs --apply    → sao lưu → xoá → nạp → ảnh
 *
 * Quy tắc chuyển:
 *  · code = mã app cũ; `mold_code` khác mã → vào `legacy_codes`.
 *  · category → profile_shape; height/width/thickness → section_a/b, wall; Ống tròn
 *    → outer_diameter; length 6000 → bar_length_m 6.
 *  · kg/m: dòng Nhôm Hoàng Gia ghi kg/MÉT; dòng Phong Gia Phát ghi kg/CÂY 6 m
 *    (PGP-D12 Ø12×1,8 = 0,936 kg/cây ↔ 0,156 kg/m) → chia 6, ghi rõ ở source_note.
 *  · mold_status active → active; remade → active + sự kiện 'reopened'.
 *  · holder_name đọc từ note "Đơn vị: X … đã chuyển khuôn về Y" (lấy Y nếu có).
 *  · Mã trùng trong app cũ (3 mã) giữ cả hai dòng, đánh dấu needs_review.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const SRC = 'backups/fs_profile-from-debugbar-1008.json'
const IMG_DIR = 'D:/New folder/Hoanggia/uploads/profiles/'
const BUCKET = 'attachments'
const SUPPLIER_ID = {
  'Phong Gia Phát': '483e4f66-eac9-4a90-8f1e-8f59d178d267', // Công ty TNHH Nhôm Phong Gia Phát
}
const SOURCE = 'fs_profile app cũ (bóc 08/10/2026, nạp 09/10/2026)'

const sb = await client(import.meta.url)
const rows = JSON.parse(readFileSync(SRC, 'utf8'))

const num = (v) => (v == null || v === '' ? null : Number(v))
const safeName = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60)
const alloyOf = (s) => {
  const t = (s ?? '').trim()
  if (!t) return null
  if (/96/.test(t)) return 'Nhôm 96%'
  if (/6063-T5/i.test(t)) return 'Nhôm 6063-T5'
  if (/6063/.test(t)) return 'Nhôm 6063'
  return t
}
const holderOf = (note) => {
  const t = note ?? ''
  const ve = /chuy[eể]n\s+(?:khuôn\s+)?(?:về|qua|sang)\s+([^-.;,\n]+)/i.exec(t)
  if (ve) return ve[1].trim()
  const dv = /Đơn vị:\s*([^-;,\n]+)/i.exec(t)
  return dv ? dv[1].trim() : null
}
const specOf = (r) => {
  const h = num(r.height),
    w = num(r.width),
    t = num(r.thickness)
  const dims = [h, w].filter((v) => v != null).join('x')
  const cat = (r.category ?? '').replace(' / Thanh dẹp', '')
  return [cat, dims, t != null ? `${t}li` : ''].filter(Boolean).join(' ') || null
}

const dup = rows.reduce((m, r) => ((m[r.code] = (m[r.code] || 0) + 1), m), {})
const dies = rows.map((r) => {
  const pgp = r.supplier_name === 'Phong Gia Phát'
  const kgRaw = num(r.weight_density)
  const kgm = kgRaw == null ? null : pgp ? +(kgRaw / 6).toFixed(4) : kgRaw
  const tron = r.category === 'Ống tròn'
  const legacy =
    r.mold_code && r.mold_code.trim() !== r.code.trim() ? [r.mold_code.trim()] : []
  const id = randomUUID()
  return {
    _src: r,
    _img: r.image ? IMG_DIR + r.image : null,
    row: {
      id,
      code: r.code.trim(),
      name: (r.name ?? '').trim() || null,
      profile_spec: specOf(r),
      weight_per_m: kgm,
      unit: 'Cây',
      die_price: num(r.mold_price),
      supplier_name: r.supplier_name ?? null,
      supplier_id: SUPPLIER_ID[r.supplier_name] ?? null,
      status: 'active',
      is_current: true,
      effective_date: r.mold_modified_date || null,
      note:
        [r.note, r.bending_type ? `Uốn: ${r.bending_type}` : null]
          .filter(Boolean)
          .join(' · ') || null,
      profile_shape: r.category ?? null,
      alloy: alloyOf(r.alloy),
      holder_name: holderOf(r.note) ?? (pgp ? 'Phong Gia Phát' : null),
      legacy_codes: legacy,
      data_confidence: dup[r.code] > 1 ? 'needs_review' : 'confirmed',
      review_note:
        dup[r.code] > 1
          ? `Mã lặp ${dup[r.code]} dòng trong app cũ — rà xem là 2 đời hay 2 khuôn`
          : null,
      source_note: SOURCE + (pgp && kgRaw != null ? ' · kg/m = kg/cây 6 m ÷ 6' : ''),
      section_a_mm: tron ? null : num(r.height),
      section_b_mm: tron ? null : num(r.width),
      wall_thickness_mm: num(r.thickness),
      outer_diameter_mm: tron ? num(r.height) : null,
      bar_length_m: num(r.length) ? num(r.length) / 1000 : null,
    },
    reopened: r.mold_status === 'remade',
  }
})

// ── đối chiếu ──
const cur = await sb.from('technical_dies').select('id, code, image_file_id')
if (cur.error) throw new Error(cur.error.message)
const curCodes = new Set(cur.data.map((d) => d.code.trim().toUpperCase()))
const newCodes = new Set(dies.map((d) => d.row.code.toUpperCase()))
const chung = [...newCodes].filter((c) => curCodes.has(c))
const parts = await sb
  .from('technical_product_parts')
  .select('profile_code')
  .not('profile_code', 'is', null)
const bomCodes = [
  ...new Set((parts.data ?? []).map((p) => p.profile_code.trim().toUpperCase())),
]
console.log(
  `Hiện có ${cur.data.length} khuôn · nguồn ${dies.length} dòng · mã chung ${chung.length} · mã trùng trong nguồn: ${Object.values(dup).filter((n) => n > 1).length}`,
)
console.log(
  `profile_code trên BOM: ${bomCodes.length} mã → khớp khuôn CŨ ${bomCodes.filter((c) => curCodes.has(c)).length}, khớp khuôn MỚI ${bomCodes.filter((c) => newCodes.has(c)).length}`,
)
console.log(
  `ảnh có file: ${dies.filter((d) => d._img && existsSync(d._img)).length}/${dies.length}`,
)
console.log('Mẫu 8 dòng:')
for (const d of dies
  .slice(0, 4)
  .concat(dies.filter((d) => d._src.supplier_name === 'Phong Gia Phát').slice(0, 4)))
  console.log(
    `  ${d.row.code} | ${d.row.profile_shape} | ${d.row.profile_spec} | kg/m ${d.row.weight_per_m} | ${d.row.alloy} | giữ: ${d.row.holder_name} | ${d.row.name ?? ''}`.slice(
      0,
      160,
    ),
  )

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để sao lưu, xoá và nạp)')
  process.exit(0)
}

// ── sao lưu ──
mkdirSync('backups', { recursive: true })
const [full, ev, mt, fl] = await Promise.all([
  sb.from('technical_dies').select('*'),
  sb.from('technical_die_events').select('*'),
  sb.from('technical_die_materials').select('*'),
  sb.from('files').select('*').not('die_id', 'is', null),
])
for (const r of [full, ev, mt, fl]) if (r.error) throw new Error(r.error.message)
const bk = `backups/technical-dies-2026-10-09-truoc-thay.json`
writeFileSync(
  bk,
  JSON.stringify(
    { dies: full.data, events: ev.data, materials: mt.data, files: fl.data },
    null,
    0,
  ),
)
console.log(
  `\nĐã sao lưu ${full.data.length} khuôn · ${ev.data.length} sự kiện · ${mt.data.length} vật tư · ${fl.data.length} file → ${bk}`,
)

// ── xoá ──
const del = async (t, filter) => {
  const q = sb.from(t).delete()
  const r = await filter(q)
  if (r.error) throw new Error(`${t}: ${r.error.message}`)
}
await del('technical_die_events', (q) => q.not('id', 'is', null))
await del('technical_die_materials', (q) => q.not('id', 'is', null))
// gỡ con trỏ ảnh trước, rồi xoá file (rows) — object trên Storage giữ lại để còn khôi phục từ bản sao lưu
await sb.from('technical_dies').update({ image_file_id: null }).not('id', 'is', null)
await del('files', (q) => q.not('die_id', 'is', null))
await del('technical_dies', (q) => q.not('id', 'is', null))
console.log('Đã xoá toàn bộ khuôn cũ.')

// ── nạp ──
for (const b of chunk(
  dies.map((d) => d.row),
  50,
)) {
  const r = await sb.from('technical_dies').insert(b)
  if (r.error) throw new Error(`insert: ${r.error.message}`)
}
const evRows = dies
  .filter((d) => d.reopened)
  .map((d) => ({
    die_id: d.row.id,
    event_type: 'reopened',
    event_date: d.row.effective_date ?? '2026-10-09',
    note: 'App cũ ghi mold_status = remade (mở lại khuôn)',
  }))
if (evRows.length) {
  const r = await sb.from('technical_die_events').insert(evRows)
  if (r.error) console.log('⚠ sự kiện reopened:', r.error.message)
}
console.log(`Đã nạp ${dies.length} khuôn (${evRows.length} sự kiện mở lại).`)

// ── ảnh ──
let ok = 0
const errs = []
for (const b of chunk(dies, 6)) {
  await Promise.all(
    b.map(async (d) => {
      if (!d._img || !existsSync(d._img)) return
      const buffer = readFileSync(d._img)
      const ext = d._img.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
      const filename = `${safeName(d.row.code)}.${ext === 'png' ? 'png' : 'jpg'}`
      const path = `die/${d.row.id}/${randomUUID()}-${filename}`
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
      const up = await sb.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: mime, upsert: false })
      if (up.error) return errs.push(`${d.row.code}: storage ${up.error.message}`)
      const ins = await sb
        .from('files')
        .insert({
          bucket: BUCKET,
          path,
          filename,
          mime_type: mime,
          size_bytes: buffer.byteLength,
          die_id: d.row.id,
          doc_type: 'image',
          finalized_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (ins.error) return errs.push(`${d.row.code}: files ${ins.error.message}`)
      const upd = await sb
        .from('technical_dies')
        .update({ image_file_id: ins.data.id })
        .eq('id', d.row.id)
      if (upd.error) return errs.push(`${d.row.code}: image_file_id ${upd.error.message}`)
      ok++
    }),
  )
}
console.log(
  `Ảnh: ${ok}/${dies.length} gắn xong${errs.length ? `; lỗi ${errs.length}: ${errs.slice(0, 5).join(' | ')}` : ''}`,
)
