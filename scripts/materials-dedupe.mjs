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

import { writeFileSync } from 'node:fs'
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
for (const g of sure.slice(0, 20)) {
  const [k, ...d] = chonGiuLai(g)
  console.log(
    `  GIỮ ${k.code} "${k.name.slice(0, 38)}"  ←  bỏ ${d.map((x) => `${x.code} "${x.name.slice(0, 38)}"`).join(' · ')}`,
  )
}
if (sure.length > 20) console.log(`  … còn ${sure.length - 20} cụm`)

console.log(`\n── CỤM NGHI NGỜ (cần người rà, KHÔNG tự gộp): ${soft.length} ──`)
for (const g of soft.slice(0, 20))
  console.log(`  ${g.map((x) => `${x.code} "${x.name}"`).join('  ?  ')}`)
if (soft.length > 20) console.log(`  … còn ${soft.length - 20} cụm`)

if (!APPLY) {
  console.log('\n(dry-run — thêm --apply để gộp các cụm CHẮC CHẮN)')
  process.exit(0)
}

/**
 * Chọn dòng GIỮ LẠI trong một cụm trùng.
 *
 * Ưu tiên MÃ CỦA SỔ CUNG ỨNG (không dấu gạch: `BAO0679`) hơn mã app tự cấp
 * (`BB-0009`) — chủ dự án chốt 02/08 lấy sổ làm chuẩn, và mã sổ là thứ in trên
 * báo giá, đơn đặt, nằm trong trí nhớ nhân viên. Cùng loại thì lấy mã nhỏ hơn
 * (vào danh mục trước).
 */
function chonGiuLai(cum) {
  const laSo = (m) => !m.code.includes('-')
  return [...cum].sort((a, b) => {
    if (laSo(a) !== laSo(b)) return laSo(a) ? -1 : 1
    return a.code.localeCompare(b.code)
  })
}

/**
 * Những trường mà dòng bị bỏ có thể đang giữ còn dòng giữ lại thì trống.
 *
 * Xoá thẳng là mất luôn — và mất kiểu này không ai thấy: `kg_per_m` của 635
 * dòng nhôm/sắt lấy từ bảng quy cách Đức Toàn, sổ Cung ứng chỉ suy được cho
 * 389/8.015 dòng. Gộp trùng mà đánh rơi barem là dòng đơn nhôm sau đó tính
 * tiền theo số cây thay vì theo kg.
 */
const CUU_TRUONG = [
  'kg_per_m',
  'default_bar_length_m',
  'spec',
  'sub_group',
  'vat_rate',
  'default_supplier_id',
  'last_purchase_price',
  'po_template',
  'barcode',
]

let merged = 0
let skipped = 0
let rescued = 0
for (const g of sure) {
  const [keep, ...drop] = chonGiuLai(g)

  // Đọc đủ trường của cả cụm để cứu dữ liệu trước khi xoá.
  const { data: full } = await sb
    .from('warehouse_materials')
    .select(`id, code, note, ${CUU_TRUONG.join(', ')}`)
    .in(
      'id',
      g.map((x) => x.id),
    )
  const byId = new Map((full ?? []).map((r) => [r.id, r]))
  const patch = {}
  const keepRow = byId.get(keep.id) ?? {}
  for (const f of CUU_TRUONG) {
    if (keepRow[f] != null && keepRow[f] !== '') continue
    const donor = drop
      .map((d) => byId.get(d.id))
      .find((r) => r?.[f] != null && r[f] !== '')
    if (donor) {
      patch[f] = donor[f]
      rescued++
    }
  }

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

  // Ghi vết + cứu trường vào MỘT lần update trên mã giữ lại.
  if (drop.length) {
    /*
     * NỐI vào note cũ, KHÔNG ghi đè.
     *
     * Note đang mang dấu nguồn "Nguồn: sổ vật tư Cung ứng (Drive)" — đó là
     * đường ĐẢO LẠI cả đợt nạp 11.744 dòng. Bản đầu ghi đè và xoá mất dấu của
     * 72 dòng: lệnh dọn theo dấu đó sẽ bỏ sót đúng 72 dòng, im lặng.
     */
    const cu = String(keepRow.note ?? '').trim()
    const them = `Gộp trùng danh mục 02/08/2026: ${drop.map((d) => `${d.code} "${d.name}"`).join(' · ')}${
      Object.keys(patch).length
        ? ` · giữ lại từ mã bỏ: ${Object.keys(patch).join(', ')}`
        : ''
    }`
    const { error } = await sb
      .from('warehouse_materials')
      .update({ ...patch, note: cu ? `${them} · ${cu}` : them })
      .eq('id', keep.id)
    if (error) console.error(`  ✗ cập nhật ${keep.code}: ${error.message}`)
  }
}
/*
 * Bảng rà TÊN sau khi gộp.
 *
 * `sureKey` bỏ dấu nên "Thẽ treo" và "Thẻ treo" là một cụm — đúng để NHẬN ra
 * trùng, nhưng lúc chọn tên giữ lại thì máy không có cơ sở nào để biết bên nào
 * viết đúng chính tả. Giữ theo mã sổ là quy tắc đã chốt, còn tên thì in ra cho
 * người sửa: 73 dòng, mắt người liếc qua là xong.
 */
const rows = sure.map((g) => {
  const [k, ...d] = chonGiuLai(g)
  const khacDau = d.some(
    (x) =>
      nod(x.name).replace(/[^a-z0-9]/g, '') !== nod(k.name).replace(/[^a-z0-9]/g, ''),
  )
  return { k, d, khacDau }
})
const canRa = rows.filter((r) => r.khacDau)
let md = `# Gộp trùng danh mục 02/08/2026\n\n`
md += `${sure.length} cụm trùng mức "chắc chắn" đã gộp. Giữ MÃ CỦA SỔ Cung ứng\n`
md += `(không dấu gạch), bỏ mã app tự cấp — theo quyết định lấy sổ làm chuẩn.\n\n`
md += `## ${canRa.length} cụm nên rà lại TÊN\n\n`
md += `\`sureKey\` bỏ dấu để nhận ra trùng, nên "Thẽ treo" và "Thẻ treo" vào cùng cụm.\n`
md += `Máy giữ tên theo mã sổ; chỗ nào sổ viết sai chính tả thì sửa tay tên của mã giữ lại.\n\n`
md += `| Mã giữ | Tên đang giữ | Tên của mã đã bỏ |\n|---|---|---|\n`
for (const r of canRa)
  md += `| ${r.k.code} | ${r.k.name} | ${r.d.map((x) => `${x.code} "${x.name}"`).join(' · ')} |\n`
md += `\n## ${sure.length - canRa.length} cụm tên trùng khít, không cần rà\n`
writeFileSync('D:/HG-ERP/docs/gop-trung-danh-muc.md', md, 'utf8')

console.log(
  `\n✓ gộp ${merged} mã trùng · cứu ${rescued} giá trị khỏi mã bị bỏ · giữ lại ${skipped} mã (có chứng từ)`,
)
console.log(`  ${canRa.length} cụm cần rà tên → docs/gop-trung-danh-muc.md`)
