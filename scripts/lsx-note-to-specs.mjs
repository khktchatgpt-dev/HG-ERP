// CHUYỂN SPEC KẸT TRONG GHI CHÚ NHÓM LSX → CỘT SPEC TỪNG DÒNG + HỒ SƠ SP (08/2026).
//
//   node scripts/lsx-note-to-specs.mjs            (xem thử — không ghi gì)
//   node scripts/lsx-note-to-specs.mjs --apply    (ghi thật)
//
// File LSX cũ (ROSCO) ghi spec vào Ô GHI CHÚ GỘP của nhóm:
//   "Kính cường lực 8mm / Nệm dày 5cm / Mây|Wicker: X / Vải|Fabric: Y / Lỗ dù nhôm"
// Import 05/08 giữ nguyên khối đó ở production_order_groups.note nên cột spec
// dòng trống, hồ sơ SP cũng trống theo. Script này:
//   1. DÒNG LỆNH — bơm spec từ note nhóm:
//        · may  : lấy giá trị "Mây:/Wicker:" (GHI ĐÈ — cùng nguồn file, bản
//                 trong note giàu thông tin hơn mã màu trần đang có);
//        · nem  : "Nệm …" + "Vải: Y" — CHỈ điền khi đang trống và dòng có vải
//                 (FINISH nhắc fabric/olefin) — không gắn nệm cho mặt bàn kính;
//        · kinh : "Kính …" — chỉ điền khi trống và FINISH nhắc glass/kính.
//      Ghi chú nhóm GIỮ NGUYÊN (không xoá gì); KHÔNG bump revision — đây là
//      dọn dữ liệu import, không phải chỉnh sửa nghiệp vụ.
//   2. HỒ SƠ SP — bổ sung từ dòng: CHỈ điền trường hồ sơ đang trống (cushion/
//      glass/machine…/barcode/name_foreign/đóng gói/cbm), bỏ qua placeholder
//      "xác nhận sau" — cùng quy tắc với nút "Bổ sung vào hồ sơ SP" trên app.
//
// Idempotent: giá trị đích trùng thì bỏ qua; chạy lại vô hại.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)
const die = (msg, error) => {
  console.error('✗', msg, error?.message ?? '')
  process.exit(1)
}

const PENDING =
  /(xac nhan sau|thong bao sau|cho ky|cho xac nhan|dang cho|doi thong tin|se gui|sau khi)/
const norm = (v) =>
  (v ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
const usable = (v) => {
  const t = (v ?? '').trim()
  return t && !PENDING.test(norm(t)) ? t : ''
}

/** Tách note nhóm thành spec: { may, nem, kinh } (thiếu phần nào bỏ phần đó). */
function parseGroupNote(note) {
  let may = ''
  let nemBase = ''
  let fabric = ''
  let kinh = ''
  for (const raw of (note ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(/^(?:mây|wicker)\s*:\s*(.+)$/i)
    if (m) {
      may = m[1].trim()
      continue
    }
    const f = line.match(/^(?:vải|fabric)\s*:\s*(.+)$/i)
    if (f) {
      fabric = f[1].trim()
      continue
    }
    if (/^nệm/i.test(line)) nemBase = line
    else if (/^kính/i.test(line)) kinh = line
  }
  const nem = [nemBase, fabric && `Vải: ${fabric}`].filter(Boolean).join(' · ')
  return { may, nem, kinh }
}

// ── 1. Dòng lệnh: bơm spec từ note nhóm ─────────────────────────────────────
const { data: groups, error: gErr } = await db
  .from('production_order_groups')
  .select('id, po_no, note')
  .not('note', 'is', null)
  .neq('note', '')
if (gErr) die('đọc groups', gErr)

let lineUpdates = 0
const touchedProductIds = new Set()

for (const g of groups) {
  const spec = parseGroupNote(g.note)
  if (!spec.may && !spec.nem && !spec.kinh) continue

  const { data: lines, error: lErr } = await db
    .from('production_order_lines')
    .select('id, product_code, product_id, specs, note')
    .eq('group_id', g.id)
  if (lErr) die(`đọc lines nhóm ${g.po_no}`, lErr)

  for (const l of lines) {
    const specs = { ...(l.specs ?? {}) }
    const finish = norm(l.note)
    const before = JSON.stringify(specs)

    if (spec.may && specs.may !== spec.may) specs.may = spec.may
    if (spec.nem && !usable(specs.nem) && /fabric|olefin|cushion|nem/.test(finish))
      specs.nem = spec.nem
    if (spec.kinh && !usable(specs.kinh) && /glass|kinh/.test(finish))
      specs.kinh = spec.kinh

    if (JSON.stringify(specs) === before) continue
    lineUpdates++
    if (l.product_id) touchedProductIds.add(l.product_id)
    console.log(
      `${APPLY ? '→' : '·'} [${g.po_no}] ${l.product_code}: ${Object.entries(specs)
        .filter(([k, v]) => (l.specs ?? {})[k] !== v)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' | ')}`,
    )
    if (APPLY) {
      const { error } = await db
        .from('production_order_lines')
        .update({ specs })
        .eq('id', l.id)
      if (error) die(`ghi specs dòng ${l.product_code}`, error)
    }
  }
}

// ── 2. Hồ sơ SP: bổ sung CHỖ TRỐNG từ dòng lệnh (mọi dòng của các LSX) ──────
const { data: allLines, error: alErr } = await db
  .from('production_order_lines')
  .select('product_id, specs, note, packing, cbm, barcode, name_foreign')
  .not('product_id', 'is', null)
if (alErr) die('đọc toàn bộ dòng', alErr)

const byProduct = new Map()
for (const l of allLines) {
  const arr = byProduct.get(l.product_id) ?? []
  arr.push(l)
  byProduct.set(l.product_id, arr)
}

const SPEC_TO_PRODUCT = {
  may: 'machine',
  nem: 'cushion',
  son: 'paint',
  kinh: 'glass',
  go: 'wood',
}
const ids = [...byProduct.keys()]
const { data: products, error: pErr } = await db
  .from('technical_products')
  .select('id, code, name_foreign, barcode, tech_spec, packing')
  .in('id', ids)
if (pErr) die('đọc hồ sơ SP', pErr)

let profileUpdates = 0
for (const p of products) {
  const lines = byProduct.get(p.id) ?? []
  const firstVal = (pick) => {
    for (const l of lines) {
      const v = usable(pick(l))
      if (v) return v
    }
    return ''
  }

  const patch = {}
  const filled = []

  if (!(p.name_foreign ?? '').trim()) {
    const v = firstVal((l) => l.name_foreign)
    if (v) {
      patch.name_foreign = v
      filled.push('name_foreign')
    }
  }
  if (!(p.barcode ?? '').trim()) {
    const v = firstVal((l) => l.barcode)
    if (v) {
      patch.barcode = v
      filled.push('barcode')
    }
  }

  const tech = { ...(p.tech_spec ?? {}) }
  let techChanged = false
  for (const [specKey, prodKey] of Object.entries(SPEC_TO_PRODUCT)) {
    if ((tech[prodKey] ?? '').trim()) continue
    const v = firstVal((l) => l.specs?.[specKey])
    if (v) {
      tech[prodKey] = v
      techChanged = true
      filled.push(prodKey)
    }
  }
  if (techChanged) patch.tech_spec = tech

  const packing = { ...(p.packing ?? {}) }
  let packChanged = false
  if (!packing.qty_per_carton) {
    const raw = firstVal((l) => l.packing)
    const m = raw.match(/^(\d+)[^/]*\/\s*(.+)$/)
    if (m) {
      packing.qty_per_carton = Number(m[1])
      packing.pack_unit_label = m[2].trim()
      packChanged = true
      filled.push('đóng gói')
    }
  }
  const hasCarton =
    packing.carton_l_cm != null &&
    packing.carton_w_cm != null &&
    packing.carton_h_cm != null
  if (packing.cbm == null && !hasCarton) {
    const l = lines.find((x) => x.cbm != null)
    if (l) {
      packing.cbm = Number(l.cbm)
      packChanged = true
      filled.push('cbm')
    }
  }
  if (packChanged) patch.packing = packing

  if (!filled.length) continue
  profileUpdates++
  console.log(`${APPLY ? '→' : '·'} SP ${p.code}: bổ sung ${filled.join(', ')}`)
  if (APPLY) {
    const { error } = await db.from('technical_products').update(patch).eq('id', p.id)
    if (error) die(`ghi hồ sơ SP ${p.code}`, error)
  }
}

console.log(
  `\n${APPLY ? 'ĐÃ GHI' : 'XEM THỬ (chưa ghi — thêm --apply để ghi thật)'}: ` +
    `${lineUpdates} dòng lệnh, ${profileUpdates} hồ sơ SP.`,
)
