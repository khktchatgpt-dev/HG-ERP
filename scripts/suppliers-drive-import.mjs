// NẠP HỒ SƠ NCC từ sổ gốc của phòng Cung ứng trên Drive.
//
//   node scripts/suppliers-drive-import.mjs           # dry-run, in bảng
//   node scripts/suppliers-drive-import.mjs --apply   # ghi vào supply_suppliers
//
// Nguồn: `4. Danh sach NCC/TÊN DANH SÁCH NCC NHÔM - SẮT - VẬT TƯ...xlsx`, sheet
// `SUPPLIERS LIST` + 11 sheet theo ngành. Ảnh chụp ở
// `supabase/backups/2026-08-02_drive-ncc.json`.
//
// KHÔNG dùng file `Danh sách nhà cung cấp.xlsx` (218 tên): đó là bảng ĐẾM dòng
// báo giá tự sinh — cột MST/điện thoại/địa chỉ trống hết, và lẫn cả
// "Nội bộ (kiểm kê 5.26)", "TRUNG QUỐC", "Theo dõi xuất trả mây BTV" vốn không
// phải nhà cung cấp.
//
// ĐỐI CHIẾU THEO MST TRƯỚC, TÊN SAU. Tên NCC trong sổ viết đủ kiểu
// ("tân phát" / "CÔNG TY TNHH TÂN PHÁT"), còn MST là định danh pháp lý. Khớp
// theo tên trước là gộp nhầm "Phước Khang" với "Phú Khang" — chính file gốc
// cũng liệt 34 cặp nghi trùng tên.
//
// CHỈ ĐIỀN Ô TRỐNG cho NCC đã có: 40 NCC hiện tại có 4 đơn đặt + 10 dòng bảng
// giá dính vào, và người dùng đã sửa tay trên app. Ghi đè là xoá công sức đó.

import { readFileSync } from 'node:fs'
import { client, chunk } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const SRC =
  process.argv.find((a) => a.endsWith('.json')) ??
  'supabase/backups/2026-08-02_drive-ncc.json'

const src = JSON.parse(readFileSync(SRC, 'utf8'))
const sb = await client(import.meta.url)

const nod = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\b(cong ty|cty|tnhh|cp|co phan|mtv|sx|tm|dv|xnk|va|&)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '')

const { data: hienCo, error } = await sb
  .from('supply_suppliers')
  .select('id, code, name, tax_no, phone, address, legal_rep, type, contact_name')
  .limit(2000)
if (error) throw new Error(error.message)

const byTax = new Map()
const byName = new Map()
for (const s of hienCo ?? []) {
  if (s.tax_no) byTax.set(String(s.tax_no).trim(), s)
  const k = nod(s.name)
  if (k.length >= 4 && !byName.has(k)) byName.set(k, s)
}

const them = []
const boSung = [] // đã có, điền thêm ô trống
const khongDung = [] // đã có, không thiếu gì

/*
 * Tầng 3: tên CHỨA NHAU sau khi bỏ từ pháp nhân.
 *
 * Sổ và app viết tên cùng một công ty dài ngắn khác nhau —
 * "CÔNG TY TNHH NHÔM ĐOÀN GIA ( TAIWANT )" ↔ "Công Ty TNHH Nhôm Đoàn Gia",
 * "CÔNG TY NHỰA AN THÀNH PHÁT" ↔ "CÔNG TY TNHH SX TM TH AN THÀNH PHÁT".
 * Không có tầng này thì chúng vào thành NCC thứ hai, và bảng giá của một công
 * ty nằm ở hai hồ sơ.
 *
 * Chỉ nhận khi CHỈ CÓ MỘT ứng viên. Nhiều ứng viên nghĩa là tên quá chung
 * ("Tân Phát" nằm trong cả "Sơn Tín Phát"), gộp bừa là nhập nhầm pháp nhân.
 */
function chuaNhau(name) {
  const k = nod(name)
  if (k.length < 5) return null
  const hits = [...byName.entries()].filter(
    ([bk]) => bk.length >= 5 && (bk.includes(k) || k.includes(bk)),
  )
  return hits.length === 1 ? hits[0][1] : null
}

const khopMo = []
for (const r of src.rows) {
  let hit = (r.tax_no && byTax.get(r.tax_no)) || null
  if (!hit && nod(r.name).length >= 4) hit = byName.get(nod(r.name)) ?? null
  if (!hit) {
    hit = chuaNhau(r.name)
    if (hit) khopMo.push({ r, hit })
  }

  if (!hit) {
    them.push(r)
    continue
  }
  // Chỉ vá ô trống.
  const patch = {}
  for (const f of ['tax_no', 'phone', 'address', 'legal_rep', 'type', 'contact_name']) {
    if ((hit[f] == null || hit[f] === '') && r[f] != null && r[f] !== '') patch[f] = r[f]
  }
  if (Object.keys(patch).length) boSung.push({ hit, patch, r })
  else khongDung.push({ hit, r })
}

console.log(`NGUỒN: ${SRC} — ${src.rows.length} NCC (bóc ${src.ngay_boc})`)
console.log(`SUPPLY_SUPPLIERS hiện có: ${hienCo.length}`)
console.log(`\n── THÊM MỚI: ${them.length} ──`)
for (const r of them.slice(0, 10))
  console.log(
    `  ${(r.tax_no ?? '—').padEnd(12)} ${r.name.slice(0, 44).padEnd(46)} ${r.type ?? ''}`,
  )
if (them.length > 10) console.log(`  … còn ${them.length - 10}`)

console.log(`\n── ĐÃ CÓ, điền thêm ô trống: ${boSung.length} ──`)
for (const b of boSung.slice(0, 10))
  console.log(
    `  ${b.hit.code ?? '—'} ${b.hit.name.slice(0, 34).padEnd(36)} + ${Object.keys(b.patch).join(', ')}`,
  )
if (boSung.length > 10) console.log(`  … còn ${boSung.length - 10}`)
if (khopMo.length) {
  console.log(`\n── KHỚP MỜ (tên chứa nhau, KHÔNG theo MST): ${khopMo.length} ──`)
  console.log('   Coi là CÙNG một NCC. Sai chỗ nào thì sửa trước khi --apply.')
  for (const k of khopMo)
    console.log(
      `  sổ "${k.r.name.slice(0, 44)}"  ≡  app ${k.hit.code ?? '—'} "${k.hit.name.slice(0, 40)}"`,
    )
}
console.log(`\n── ĐÃ CÓ, không thiếu gì: ${khongDung.length} ──`)
for (const k of khongDung.slice(0, 5))
  console.log(`  ${k.hit.code ?? '—'} ${k.hit.name.slice(0, 44)}`)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để ghi)')
  process.exit(0)
}

let ok = 0
for (const part of chunk(
  them.map((r) => ({
    name: r.name,
    type: r.type,
    tax_no: r.tax_no,
    phone: r.phone,
    email: r.email,
    address: r.address,
    legal_rep: r.legal_rep,
    contact_name: r.contact_name,
    status: 'active',
    is_active: true,
    note: `Nguồn: sổ NCC phòng Cung ứng (Drive) 02/08/2026 · sheet ${r.nguon.join(', ')}`,
  })),
  200,
)) {
  const { error } = await sb.from('supply_suppliers').insert(part)
  if (error) {
    console.error(`✗ thêm mới: ${error.message}`)
    process.exit(1)
  }
  ok += part.length
}
let va = 0
for (const b of boSung) {
  const { error } = await sb.from('supply_suppliers').update(b.patch).eq('id', b.hit.id)
  if (error) console.error(`  ✗ ${b.hit.name}: ${error.message}`)
  else va++
}
console.log(`\n✓ thêm ${ok} NCC · vá ${va} hồ sơ thiếu`)
