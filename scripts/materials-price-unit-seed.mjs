// NẠP "CÁCH NCC BÁO GIÁ" (price_unit + unit2_factor) cho vật tư ĐVT dạng
// bao/chai/thùng — nguồn cho ô "Giá theo ĐV khác" tự điền trên đơn (0182).
//
//   node scripts/materials-price-unit-seed.mjs            # dò khô, in bảng
//   node scripts/materials-price-unit-seed.mjs --apply    # ghi
//
// VÌ SAO CẦN: danh mục 684 vật tư nhóm Sơn có 0 dòng khai price_unit — ô chọn
// mới dựng xong không có nguồn tự điền. Nhưng chính TÊN vật tư đã ghi quy cách
// ("Sơn PU 17.5L", "Keo 600ml", "Sơn bột 25kg/bao") — bóc ra là có.
//
// BA CHỐT AN TOÀN (bài học materials-dedupe: đừng đoán quá tay):
//  1. CHỈ điền ô đang NULL cả cặp — không đè bất kỳ giá trị người khai.
//  2. CHỈ nhận mẫu RÕ RÀNG: số + đơn vị (L/lít/ml/kg/g) đứng trong tên, và ĐVT
//     phải là dạng CHỨA ĐỰNG (Thùng/Lon/Chai/Can/Phuy/Xô/Hộp/Bình/Bao/Túi/Tuýp).
//     ĐVT đã là Kg/Lít thì thôi — giá theo chính ĐVT, không cần quy đổi.
//  3. Số ghi vào là số BÓC TỪ TÊN, hiện nguyên trên ô "17.5 Lít" của dòng đơn —
//     người soạn thấy và sửa được, không phải hằng số chôn trong máy.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const db = await client(import.meta.url)

/** ĐVT dạng chứa đựng — chỉ các ĐVT này mới cần quy đổi ra lít/kg. */
const CONTAINER_UNITS = new Set([
  'thùng',
  'lon',
  'chai',
  'can',
  'phuy',
  'xô',
  'hộp',
  'bình',
  'bao',
  'túi',
  'tuýp',
  'lọ',
  'gói',
  'bì',
])

/**
 * Bóc "17.5L" / "600ml" / "25kg" / "500g" từ tên. Trả {factor, unit} theo đơn
 * vị GỐC (Lít/Kg) hoặc null khi tên không nói gì rõ ràng.
 * Lấy mẫu CUỐI CÙNG trong tên: "Sơn 2K 1L (bộ 4)" — số dung tích thường đứng
 * sát cuối phần mô tả, các số đầu hay là mã màu.
 */
export function parseVolumeOrWeight(name) {
  /*
   * `\b` của JS không coi chữ CÓ DẤU là chữ — "Chai RP7 lớn" match "7 l" thành
   * 7 Lít (dò khô bắt được). Tự chặn đuôi bằng (?![\p{L}\d]): sau đơn vị không
   * được là chữ (kể cả có dấu) hay số. Bắt cả bội số "6x4L" = thùng 24L.
   */
  const re =
    /(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)\s*(lít|lit|ml|kg|gr|l|g)(?![\p{L}\d])/giu
  let m = null
  for (const hit of name.matchAll(re)) m = hit
  if (!m) return null
  const mult = m[1] ? Number(m[1]) : 1
  const num = Number(m[2].replace(',', '.')) * (mult > 0 ? mult : 1)
  if (!(num > 0)) return null
  const u = m[3].toLowerCase()
  if (u === 'ml') return { factor: num / 1000, unit: 'Lít' }
  if (u === 'l' || u === 'lít' || u === 'lit') return { factor: num, unit: 'Lít' }
  if (u === 'g' || u === 'gr') return { factor: num / 1000, unit: 'Kg' }
  return { factor: num, unit: 'Kg' }
}

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('warehouse_materials')
    .select('id, code, name, unit, price_unit, unit2_factor, group_name')
    .eq('is_active', true)
    .eq('group_name', 'Sơn - dầu - keo - hoá chất')
    .range(from, from + 999)
  if (error) throw new Error(error.message)
  rows.push(...data)
  if (data.length < 1000) break
}

const hits = []
let skippedDeclared = 0
let skippedUnit = 0
for (const m of rows) {
  if (m.price_unit != null || m.unit2_factor != null) {
    skippedDeclared++
    continue // chốt 1: không đè
  }
  if (!CONTAINER_UNITS.has((m.unit ?? '').trim().toLowerCase())) {
    skippedUnit++
    continue // chốt 2: chỉ ĐVT chứa đựng
  }
  const parsed = parseVolumeOrWeight(m.name)
  if (!parsed) continue
  hits.push({ ...m, ...parsed, order_unit: m.unit })
}

console.log(`Nhóm Sơn-dầu-keo: ${rows.length} vật tư`)
console.log(`  · đã khai sẵn (không đụng): ${skippedDeclared}`)
console.log(`  · ĐVT không phải dạng chứa đựng: ${skippedUnit}`)
console.log(`  · BÓC ĐƯỢC từ tên: ${hits.length}\n`)
for (const h of hits) {
  console.log(
    `  ${h.code.padEnd(10)} ${h.name.slice(0, 46).padEnd(48)} 1 ${h.order_unit.padEnd(6)} = ${String(Math.round(h.factor * 1000) / 1000).padStart(7)} ${h.unit}`,
  )
}

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
  process.exit(0)
}

let done = 0
for (const h of hits) {
  const { error } = await db
    .from('warehouse_materials')
    .update({ price_unit: h.unit, unit2_factor: h.factor })
    .eq('id', h.id)
    .is('price_unit', null) // chốt 1 lần nữa ngay tại câu UPDATE
  if (error) throw new Error(`${h.code}: ${error.message}`)
  if (++done % 50 === 0) console.log(`  … ${done}/${hits.length}`)
}
console.log(`✓ đã ghi ${done} vật tư`)
