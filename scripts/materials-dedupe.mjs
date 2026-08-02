// DÒ & GỘP VẬT TƯ TRÙNG trong `warehouse_materials`.
//
//   node scripts/materials-dedupe.mjs            # chỉ in các cụm nghi trùng
//   node scripts/materials-dedupe.mjs --apply    # gộp cụm CHẮC CHẮN, giữ mã nhỏ nhất
//
// Vì sao có trùng: danh mục nạp từ nhiều nguồn viết tay khác nhau, cùng một con
// long đền ra 4 mã:
//   "LĐN 6x16x2 đen" · "LĐN 6x16x2, màu đen" · "LĐN 6x16x2 ly" · "LĐN 6x16x2 , đem"
// Để nguyên thì mỗi đơn hàng trỏ vào một mã khác nhau, tồn kho và giá mua vỡ vụn.
//
// HAI MỨC, KHÔNG GỘP BỪA:
//   · CHẮC CHẮN — chỉ khác dấu câu / khoảng trắng / chữ "màu" / đuôi "ly|li".
//     Máy gộp được: nghĩa không đổi.
//   · NGHI NGỜ  — cùng chữ đầu + cùng bộ số nhưng khác chữ (thiếu màu, sai chính
//     tả "đem"/"đen", khác hậu tố). CHỈ IN RA cho người rà: "LĐN 6x16x2 đen" và
//     "LĐN 6x16x2 xám" là hai mặt hàng thật, gộp là đặt nhầm màu.
//
// AN TOÀN: trước khi gộp, đếm chứng từ đang trỏ vào mã sắp bỏ (dòng PO, bảng giá
// NCC, phiếu kho). Có chứng từ thì KHÔNG đụng, chỉ in ra.
//
// Từ 02/08 server CHẶN sẵn trùng mức "chắc chắn" lúc tạo, nên script này chủ yếu
// để dọn phần danh mục nạp trước đó.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')

// Khoá so trùng dùng CHUNG với server (src/lib/material-key.ts) — chỗ CHẶN lúc
// tạo và chỗ DÒ lúc dọn phải hiểu "trùng" giống hệt nhau, không thì chặn hụt rồi
// lại đi dọn tay. Node 24 chạy thẳng .ts nhờ type-stripping.
import { nod, sureKey, softKey, MIN_KEY_LEN } from '../src/lib/material-key.ts'

const sb = await client(import.meta.url)

async function readAll(table, cols, order = 'code') {
  const PAGE = 1000
  const out = []
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select(cols)
      .order(order)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data ?? []))
    if ((data ?? []).length < PAGE) break
  }
  return out
}

const mats = await readAll('warehouse_materials', 'id, code, name, group_name, unit')

/**
 * Gom cụm TRONG CÙNG NHÓM VẬT LIỆU.
 *
 * Bỏ nhóm ra khỏi khoá là gộp nhầm chéo vật liệu: "Hộp 25x50x1" của INOX (IX-0002)
 * và "Hộp 25x50x1li" của NHÔM (NH-0080) trùng từng ký tự sau chuẩn hoá nhưng là
 * hai mặt hàng khác nhau, giá chênh nhiều lần. Tương tự "B477" (khuôn) ↔ "B-477"
 * (nhôm cây).
 */
const group = (keyFn) => {
  const m = new Map()
  for (const x of mats) {
    const k = keyFn(x.name)
    if (!k || k.length < MIN_KEY_LEN) continue
    const full = `${nod(x.group_name ?? '—')}::${k}`
    if (!m.has(full)) m.set(full, [])
    m.get(full).push(x)
  }
  return [...m.values()].filter((g) => g.length > 1)
}

const sure = group(sureKey)
const soft = group(softKey).filter(
  // Bỏ những cụm đã nằm trọn trong nhóm "chắc chắn".
  (g) => new Set(g.map((x) => sureKey(x.name))).size > 1,
)

/** Đếm chứng từ trỏ vào một vật tư — có thì không được xoá. */
async function refCount(id) {
  const tables = [
    ['supply_purchase_order_lines', 'material_id'],
    ['supply_supplier_prices', 'material_id'],
    ['warehouse_movements', 'material_id'],
  ]
  let n = 0
  for (const [t, col] of tables) {
    const { count } = await sb
      .from(t)
      .select('*', { count: 'exact', head: true })
      .eq(col, id)
    n += count ?? 0
  }
  return n
}

console.log(`Danh mục: ${mats.length} vật tư`)
console.log(
  `\n── CỤM TRÙNG CHẮC CHẮN (chỉ khác dấu câu / "màu" / đuôi ly): ${sure.length} ──`,
)
for (const g of sure.slice(0, 20))
  console.log(`  ${g.map((x) => `${x.code} "${x.name}"`).join('  ≡  ')}`)
if (sure.length > 20) console.log(`  … còn ${sure.length - 20} cụm`)

console.log(`\n── CỤM NGHI NGỜ (cần người rà, KHÔNG tự gộp): ${soft.length} ──`)
for (const g of soft.slice(0, 20))
  console.log(`  ${g.map((x) => `${x.code} "${x.name}"`).join('  ?  ')}`)
if (soft.length > 20) console.log(`  … còn ${soft.length - 20} cụm`)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để gộp các cụm CHẮC CHẮN)')
  process.exit(0)
}

let merged = 0
let skipped = 0
for (const g of sure) {
  // Giữ mã nhỏ nhất (vào danh mục trước), bỏ các mã sau.
  const [keep, ...drop] = [...g].sort((a, b) => a.code.localeCompare(b.code))
  for (const d of drop) {
    const refs = await refCount(d.id)
    if (refs > 0) {
      console.log(`  ⚠ giữ lại ${d.code} "${d.name}" — đang có ${refs} chứng từ trỏ vào`)
      skipped++
      continue
    }
    const { error } = await sb.from('warehouse_materials').delete().eq('id', d.id)
    if (error) {
      console.error(`  ✗ ${d.code}: ${error.message}`)
      continue
    }
    merged++
  }
  // Ghi lại các cách viết đã gộp vào note của mã giữ lại — sau còn tra ngược.
  if (drop.length) {
    await sb
      .from('warehouse_materials')
      .update({
        note: `Gộp trùng danh mục: ${drop.map((d) => `${d.code} "${d.name}"`).join(' · ')}`,
      })
      .eq('id', keep.id)
  }
}
console.log(`\n✓ gộp ${merged} mã trùng · giữ lại ${skipped} mã (có chứng từ)`)
