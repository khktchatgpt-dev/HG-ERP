// Nạp DANH MỤC VẬT TƯ + NHÀ CUNG CẤP từ hồ sơ kỹ thuật (thư mục của A_Lân).
//
//   node scripts/materials-import.mjs                      # dry-run, in bảng
//   node scripts/materials-import.mjs --src "E:/…/A_Lân"   # thư mục nguồn khác
//   node scripts/materials-import.mjs --apply              # ghi vào DB
//
// Vì sao cần: soạn đơn và tách đơn từ bảng kê đều đòi dòng phải trỏ vào vật tư
// trong `warehouse_materials`. Nhóm ngũ kim/phụ kiện của kho mới có 22 mã và
// không dính gì tới thứ đang mua (vít, bu lông, LĐN, tán rút, pát, gót chân) —
// nạp BKVT của LSX 04 vào thì 41/41 dòng "chưa khớp danh mục kho", không tách
// được đơn nào.
//
// BA NGUỒN, mỗi nguồn một loại dữ liệu:
//   1. `Profile Nhôm/Bảng quy cách nhôm bàn ghế Đức Toàn.xlsx`
//      → 292 quy cách nhôm chuẩn kèm **kg/6m** và **NCC cung cấp từng quy cách**.
//   2. `MERXX/MERXX/Vật tư LSX 01…xls` (sheet VT GHẾ / VT BÀN / BAO BÌ)
//      → 192 tên phụ kiện/ngũ kim/bao bì thật đang dùng.
//   3. `Profile Nhôm/KHUÔN NHÔM HOÀNG GIA.xlsx`
//      → khuôn nhôm + kg/m + NCC (bổ sung `technical_dies`).
//
// NHỮNG CHỖ DỄ SAI, ĐÃ XỬ LÝ:
//   · File ghi **kg/6m**, DB lưu **kg/m** → chia 6. Nạp thẳng là mẫu đơn nhôm
//     tính tiền gấp 6 lần (tiền = kg/m × dài × số cây × giá/kg).
//   · Cột NCC ghi gộp "Phong Gia Phát + Tiến Đạt+Taiwan" → tách, lấy tên ĐẦU
//     làm `default_supplier_id`, phần còn lại ghi vào `note` để người mua biết
//     còn ai bán.
//   · Chỉ so trùng TRONG CÙNG NHÓM: khớp theo tiết diện trần thì "Ø16 T1.0" của
//     nhôm đụng "Sắt phi 16", "Phi 16 inox", thậm chí can hoá chất 25kg.
//   · Mã tự sinh tiếp số lớn nhất đang có theo tiền tố nhóm (NH-, BB-…); nhóm
//     ngũ kim đang mượn tiền tố ST- nên cấp tiền tố riêng NK-.
//
// Không import gì từ src/ để chạy được bằng `node` trần.

import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { client } from './products-lib.mjs'

const args = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = args.indexOf(name)
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt
}
const SRC = flag('--src', 'E:/Dữ liệu A_Lân')
const APPLY = args.includes('--apply')
/**
 * Khuôn chỉ nạp khi khai `--dies`. Ô mã trong file viết tự do ("TD -HG 28",
 * "TW-22 x 60 x 1.0") nên vài mã cắt ra chưa chuẩn — mã khuôn sai thì dòng đơn
 * nhôm tra nhầm kg/m, phải có người rà trước.
 */
const WITH_DIES = args.includes('--dies')

const F_NHOM = `${SRC}/Profile Nhôm/Bảng quy cách nhôm bàn ghế Đức Toàn.xlsx`
const F_VT = `${SRC}/MERXX/MERXX/Vật tư LSX 01.26.27( 17976 HG-MX).xls`
const F_KHUON = `${SRC}/Profile Nhôm/KHUÔN NHÔM HOÀNG GIA.xlsx`

// ── tiện ích ─────────────────────────────────────────────────────────────────

const nod = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const loose = (s) => nod(s).replace(/[^a-z0-9]/g, '')

function grid(file, sheet) {
  const wb = XLSX.read(readFileSync(file), { type: 'buffer' })
  const name = sheet ?? wb.SheetNames[0]
  if (!wb.Sheets[name]) return []
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    blankrows: false,
    defval: '',
    raw: false,
  })
}

const numOf = (v) => {
  const n = parseFloat(
    String(v ?? '')
      .replace(/\s/g, '')
      .replace(',', '.'),
  )
  return Number.isFinite(n) && n > 0 ? n : null
}

/** Viết tắt gặp trong hồ sơ kỹ thuật → tên NCC đầy đủ. */
const NCC_ALIAS = new Map([
  ['pgp', 'Phong Gia Phát'],
  ['tw', 'Taiwan'],
  ['td', 'Tiến Đạt'],
])

/**
 * "Phong Gia Phát + Tiến Đạt+Taiwan" → 3 tên.
 * Ô này còn lẫn ghi chú của người lập ("chuyển sang Tiến Đạt", "Phong gia phát
 * (Đức Toàn mở khuôn)") — bóc phần trong ngoặc và cụm dẫn, không thì mỗi cách
 * ghi thành một "nhà cung cấp" riêng.
 */
const splitNcc = (v) =>
  String(v ?? '')
    .split(/[+,/]|\bvà\b/i)
    .map((s) =>
      s
        .replace(/\([^)]*\)?/g, ' ') // bỏ chú thích trong ngoặc
        .replace(/^\s*(chuyển sang|đổi sang|nay là|thay bằng)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .map((s) => NCC_ALIAS.get(nod(s)) ?? s)
    .filter((s) => s.length >= 2 && !/^(zalo|x|ghi chú|hư|bỏ)$/i.test(s))

/**
 * Khoá so trùng quy cách nhôm: hai bên viết khác hẳn ("Hộp 10 x 20 T1.0" ↔
 * "10x20 1li" ↔ "10x20xT1.0") → rút về (tiết diện | độ dày).
 */
function canonSpec(name) {
  let s = nod(name).replace(/ø|phi/g, ' phi ').replace(/[×*]/g, 'x')
  let thick = null
  const hit =
    s.match(/\bt\s*(\d+(?:[.,]\d+)?)/) ??
    s.match(/(\d+(?:[.,]\d+)?)\s*(?:li|ly)\b/) ??
    s.match(/day\s*(\d+(?:[.,]\d+)?)/)
  if (hit) {
    thick = parseFloat(hit[1].replace(',', '.'))
    s = s.replace(hit[0], ' ')
  }
  const dims = (s.match(/\d+(?:[.,]\d+)?/g) ?? [])
    .map((n) => parseFloat(n.replace(',', '.')))
    .filter((n) => n > 1 && n < 1000)
    .slice(0, 3)
  return dims.length ? `${dims.join('x')}|${thick ?? '?'}` : null
}

/**
 * Nhóm + mẫu đơn suy từ TÊN vật tư — file không có cột nhóm.
 *
 * THỨ TỰ QUAN TRỌNG: bắt NGŨ KIM trước. Tên phụ kiện hay mang chữ của vật liệu
 * khác làm định ngữ — "Vít 4x15 đầu bằng REN GỖ" không phải hàng gỗ, "Bulong
 * 6x20x13, SƠN đen" không phải sơn. Xét nhóm vật liệu trước là 9/192 dòng vào
 * nhầm nhóm, và nhầm nhóm thì kéo theo sai mẫu đơn.
 */
function classify(name) {
  const s = nod(name)
  const NGU_KIM =
    /\b(vit|bulon|bulong|bu long|tan|ldn|lds|ld |la dem|pat|pa t|rive|eru|ty sat|ty ren|khop|got chan|khoa|nam cham|ban le|oc |dinh|lo xo|banh xe|con lan|thanh truot|nut nhua|nut bit|nut chan|mac dong|cuc chan|ac |bit |luc giac|tac ke)/
  if (NGU_KIM.test(s))
    return { group: 'Ngũ kim - phụ kiện', template: 'accessory', prefix: 'NK' }

  if (/thung|carton|hop giay|to ong|mang pe|pallet|bang keo/.test(s))
    return { group: 'Bao bì', template: 'carton', prefix: 'BB' }
  if (/xop|mut|bi nhua|tui|bao pe|decal|barcode|tem\b|nhan\b|the treo/.test(s))
    return { group: 'Xốp - mút - bì nhựa', template: 'accessory', prefix: 'XM' }
  if (/day dan|day bn|day du|\bmay\b/.test(s))
    return { group: 'Mây - dây', template: 'simple', prefix: 'MA' }
  if (/\bson\b|hoa chat|cromate|phosphat|tay dau/.test(s))
    return { group: 'Sơn', template: 'simple', prefix: 'SO' }
  if (/\bgo\b|van ep|acacia|polywood|nan go|mat ban go/.test(s))
    return { group: 'Gỗ & ván', template: 'simple', prefix: 'GO' }

  return { group: 'Ngũ kim - phụ kiện', template: 'accessory', prefix: 'NK' }
}

// ── đọc nguồn ────────────────────────────────────────────────────────────────

/** Quy cách nhôm chuẩn + kg/6m + NCC. */
function readNhom() {
  const out = []
  for (const sheet of ['NHÔM ỐNG + PHI ĐẶC ', 'NHÔM HỘP', 'NHÔM VUÔNG', 'NHÔM LA']) {
    const rows = grid(F_NHOM, sheet)
    const hi = rows.findIndex((r) => r.some((c) => /^ten nhom$/.test(nod(c))))
    if (hi < 0) continue
    const head = rows[hi].map(nod)
    const ci = {
      ten: head.indexOf('ten nhom'),
      kg: head.findIndex((h) => /chuan kg/.test(h)),
      ncc: head.findIndex((h) => /nha cung cap/.test(h)),
    }
    for (const r of rows.slice(hi + 1)) {
      const ten = String(r[ci.ten] ?? '').trim()
      if (!ten || /^stt$/i.test(ten)) continue
      const kg6m = numOf(r[ci.kg])
      out.push({
        name: ten,
        // kg/6m → kg/m. Không có số thì để trống, KHÔNG đoán.
        kg_per_m: kg6m ? +(kg6m / 6).toFixed(4) : null,
        ncc: splitNcc(r[ci.ncc]),
        sheet: sheet.trim(),
      })
    }
  }
  return out
}

/** Phụ kiện / bao bì thật đang dùng, từ bảng vật tư của LSX. */
function readPhuKien() {
  const wb = XLSX.read(readFileSync(F_VT), { type: 'buffer' })
  const seen = new Map()
  for (const sheet of wb.SheetNames) {
    if (!/^VT |BAO BÌ/i.test(sheet)) continue
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
      header: 1,
      blankrows: false,
      defval: '',
      raw: false,
    })
    const hi = rows.findIndex((r) => r.some((c) => /^ten vat tu$/.test(nod(c))))
    if (hi < 0) continue
    const head = rows[hi].map(nod)
    const ci = {
      ten: head.indexOf('ten vat tu'),
      dvt: head.findIndex((h) => h === 'dvt'),
    }
    for (const r of rows.slice(hi + 1)) {
      const name = String(r[ci.ten] ?? '').trim()
      const unit = String(r[ci.dvt] ?? '').trim()
      // Dòng tiêu đề khối SP ("21600-217 GHẾ 5 BẬC TILOS - 1800 ghế") không có ĐVT.
      if (!name || !unit || /^tong|^cong\b/.test(nod(name))) continue
      const k = loose(name)
      if (!seen.has(k)) seen.set(k, { name, unit: unit.toLowerCase(), sheet })
    }
  }
  return [...seen.values()]
}

/** Khuôn nhôm + kg/m + NCC. */
function readKhuon() {
  const rows = grid(F_KHUON)
  const hi = rows.findIndex((r) => r.some((c) => /^ma sp$/.test(nod(c))))
  if (hi < 0) return []
  const head = rows[hi].map(nod)
  const ci = {
    ma: head.indexOf('ma sp'),
    ten: head.findIndex((h) => /ten san pham/.test(h)),
    kg: head.findIndex((h) => /kg\/m/.test(h)),
    ncc: head.findIndex((h) => /khach hang|nha cung cap/.test(h)),
  }
  const out = []
  for (const r of rows.slice(hi + 1)) {
    const raw = String(r[ci.ma] ?? '').trim()
    if (!raw) continue
    /*
     * Ô mã viết đủ kiểu: "TD-HG-AL03( Hư) TD-DTBD05 (Mở Lại)" · "TD - B768" ·
     * "PHI 16". Cắt ở khoảng trắng đầu tiên thì ra mã cụt vô nghĩa ("TD", "TW",
     * "PHI") — phải bắt trọn dạng <tiền tố>-<số/chữ>.
     */
    const norm = raw.toUpperCase().replace(/\s*-\s*/g, '-')
    const m = norm.match(/\b([A-Z]{2,4}-[A-Z0-9]+(?:-[A-Z0-9]+)?)(\s+\d+(?:\.\d+)?)?/)
    if (!m) continue
    /*
     * "TD -HG 28" → TD-HG28: số đứng sau phần chữ là ĐUÔI CỦA MÃ, cắt bỏ thì hai
     * khuôn khác nhau (TD-HG16 và TD-HG28) dồn thành một mã "TD-HG".
     * "TW-22 x 60 x 1.0" → TW-22: phần sau là quy cách, không phải mã.
     */
    const code = /[A-Z]$/.test(m[1]) && m[2] ? `${m[1]}${m[2].trim()}` : m[1]
    // Phần còn lại của ô là quy cách/ghi chú của khuôn.
    const spec = raw
      .replace(new RegExp(m[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '')
      .trim()
    if (!code) continue
    out.push({
      code,
      raw,
      spec,
      name: String(r[ci.ten] ?? '').trim(),
      kg_per_m: numOf(r[ci.kg]),
      ncc: splitNcc(r[ci.ncc]),
    })
  }
  return out
}

// ── chạy ─────────────────────────────────────────────────────────────────────

const nhom = readNhom()
const phuKien = readPhuKien()
const khuon = readKhuon()

const sb = await client(import.meta.url)

/**
 * Đọc theo TRANG. PostgREST chặn cứng 1000 dòng mỗi request và KHÔNG báo lỗi khi
 * `.limit()` lớn hơn — danh mục đã vượt 1000 nên đọc thiếu nghĩa là nạp trùng.
 */
async function readAll(table, cols) {
  const PAGE = 1000
  const out = []
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .order('code')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  return out
}

const [mats, sups, dies] = await Promise.all([
  readAll('warehouse_materials', 'id, code, name, group_name, kg_per_m'),
  readAll('supply_suppliers', 'id, code, name, short_name'),
  readAll('technical_dies', 'code'),
])

/** Tra NCC theo tên/mã, chấp nhận viết hoa-thường và tên ngắn. */
function findSupplier(name) {
  const k = nod(name)
  if (!k) return null
  return (
    (sups ?? []).find((s) => nod(s.code) === k) ??
    (sups ?? []).find((s) => nod(s.short_name) === k) ??
    (sups ?? []).find((s) => nod(s.name).includes(k) && k.length >= 3) ??
    null
  )
}

// Số thứ tự lớn nhất đang dùng theo tiền tố, để cấp mã mới nối tiếp.
const nextNo = new Map()
for (const m of mats ?? []) {
  const hit = String(m.code).match(/^([A-Z]{2})-(\d{4})$/)
  if (hit) nextNo.set(hit[1], Math.max(nextNo.get(hit[1]) ?? 0, Number(hit[2])))
}
const genCode = (prefix) => {
  const n = (nextNo.get(prefix) ?? 0) + 1
  nextNo.set(prefix, n)
  return `${prefix}-${String(n).padStart(4, '0')}`
}

// Trùng lặp: nhôm so theo tiết diện TRONG NHÓM NHÔM, còn lại so theo tên rút gọn.
const nhomCanon = new Map()
for (const m of mats ?? []) {
  const g = nod(m.group_name)
  if (!/nhom/.test(g) || /khuon/.test(g)) continue
  /*
   * Nhóm thôi chưa đủ: danh mục có mã bị xếp sai nhóm ("Sắt la 5 x20 mm" nằm
   * trong nhóm Nhôm). Khớp theo tiết diện rồi ghi kg/m của nhôm lên nó là sai
   * gần 3 lần (nhôm 2,7 g/cm³ vs sắt 7,85) và thành tiền đơn hàng sai theo.
   */
  if (/\b(sat|thep|inox)\b/.test(nod(m.name))) continue
  const k = canonSpec(m.name)
  if (k && !nhomCanon.has(k)) nhomCanon.set(k, m)
}
/**
 * Khoá tồn tại phải TRÙNG với `materials-dedupe.mjs`: bỏ dấu câu, chữ "màu",
 * đuôi đơn vị "ly|li". Nếu không, dedupe gộp "LĐN 10x20x2, đen" vào
 * "LĐN 10x20x2" xong thì lần nạp sau script này lại thêm mới — hai script đá
 * nhau, danh mục phình lại sau mỗi vòng.
 */
const sureKey = (name) =>
  nod(name)
    .replace(/\bmau\b/g, ' ')
    .replace(/(\d)\s*(?:ly|li)\b/g, '$1')
    .replace(/[^a-z0-9]/g, '')

const looseAll = new Set([
  ...(mats ?? []).map((m) => loose(m.name)),
  ...(mats ?? []).map((m) => sureKey(m.name)),
])
const existsAlready = (name) => looseAll.has(loose(name)) || looseAll.has(sureKey(name))
const dieCodes = new Set((dies ?? []).map((d) => nod(d.code)))

const newMats = []
const fillKg = [] // vật tư đã có nhưng thiếu kg/m

for (const s of nhom) {
  const k = canonSpec(s.name)
  const hit = k ? nhomCanon.get(k) : null
  if (hit) {
    if (hit.kg_per_m == null && s.kg_per_m) fillKg.push({ id: hit.id, ...s, kho: hit })
    continue
  }
  if (existsAlready(s.name)) continue
  const sup = s.ncc.map(findSupplier).find(Boolean) ?? null
  newMats.push({
    code: genCode('NH'),
    name: s.name,
    unit: 'cây',
    group_name: 'Nhôm',
    po_template: 'aluminium',
    kg_per_m: s.kg_per_m,
    default_bar_length_m: 6, // bảng chuẩn tính theo cây 6 m
    default_supplier_id: sup?.id ?? null,
    note: `Bảng quy cách nhôm (Đức Toàn) · ${s.sheet}${s.ncc.length ? ` · NCC: ${s.ncc.join(', ')}` : ''}`,
    is_active: true,
  })
}

for (const p of phuKien) {
  if (existsAlready(p.name)) continue
  const c = classify(p.name)
  newMats.push({
    code: genCode(c.prefix),
    name: p.name,
    unit: p.unit || 'cái',
    group_name: c.group,
    po_template: c.template,
    note: `Vật tư LSX 01.26.27 (MERXX) · ${p.sheet}`,
    is_active: true,
  })
}

const newDies = khuon.filter((d) => !dieCodes.has(nod(d.code)))

// ── in ───────────────────────────────────────────────────────────────────────

const byGroup = new Map()
for (const m of newMats) byGroup.set(m.group_name, (byGroup.get(m.group_name) ?? 0) + 1)

console.log(
  `\nĐỌC ĐƯỢC: ${nhom.length} quy cách nhôm · ${phuKien.length} phụ kiện · ${khuon.length} khuôn`,
)
console.log(`\nSẼ THÊM ${newMats.length} vật tư:`)
for (const [g, n] of [...byGroup.entries()].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${g}`)
console.log(`\nSẼ ĐIỀN kg/m cho ${fillKg.length} vật tư nhôm đã có:`)
for (const f of fillKg.slice(0, 10))
  console.log(`  ${f.kho.code}  ${f.kho.name}  ← ${f.name} = ${f.kg_per_m} kg/m`)
console.log(`\nSẼ THÊM ${newDies.length} khuôn:`)
for (const d of newDies)
  console.log(
    `  ${d.code.padEnd(12)} ${d.kg_per_m ?? '—'} kg/m · ${d.ncc.join('/') || '—'} · nguyên văn: ${d.raw}`,
  )

// Nhóm suy từ TÊN nên phải xem lại — in ra để người duyệt bắt lỗi phân loại.
for (const g of ['Gỗ & ván', 'Xốp - mút - bì nhựa', 'Sơn', 'Bao bì', 'Mây - dây']) {
  const rows = newMats.filter((m) => m.group_name === g)
  if (rows.length) console.log(`\n  [${g}] ${rows.map((r) => r.name).join(' · ')}`)
}
console.log('\n  [Ngũ kim - phụ kiện] 8 dòng đầu:')
for (const m of newMats.filter((x) => x.group_name === 'Ngũ kim - phụ kiện').slice(0, 8))
  console.log(`    ${m.code}  ${m.name}  (${m.unit})`)

const nccMoi = [...new Set([...nhom, ...khuon].flatMap((x) => x.ncc))].filter(
  (n) => !findSupplier(n),
)
console.log(`\nNCC trong hồ sơ CHƯA có trong supply_suppliers (${nccMoi.length}):`)
console.log('  ' + (nccMoi.join(' · ') || '—'))
console.log(
  '  → nạp bằng tay hoặc bổ sung vào scripts/suppliers-import.mjs (có địa chỉ/MST)',
)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để ghi vào DB)')
  process.exit(0)
}

let added = 0
for (let i = 0; i < newMats.length; i += 200) {
  const { error, count } = await sb
    .from('warehouse_materials')
    .insert(newMats.slice(i, i + 200), { count: 'exact' })
  if (error) {
    console.error('  ✗ vật tư:', error.message)
    break
  }
  added += count ?? 0
}
let filled = 0
for (const f of fillKg) {
  const { error } = await sb
    .from('warehouse_materials')
    .update({ kg_per_m: f.kg_per_m, default_bar_length_m: 6 })
    .eq('id', f.id)
  if (!error) filled++
}
let dieAdded = 0
if (newDies.length && WITH_DIES) {
  const { error, count } = await sb.from('technical_dies').insert(
    newDies.map((d) => ({
      code: d.code,
      name: d.name || null,
      profile_spec: d.spec || null,
      weight_per_m: d.kg_per_m,
      supplier_name: d.ncc[0] ?? null,
      is_current: true,
      note: `KHUÔN NHÔM HOÀNG GIA · ${d.raw}`,
    })),
    { count: 'exact' },
  )
  if (error) console.error('  ✗ khuôn:', error.message)
  else dieAdded = count ?? 0
}
console.log(`\n✓ thêm ${added} vật tư · điền kg/m ${filled} · thêm ${dieAdded} khuôn`)
