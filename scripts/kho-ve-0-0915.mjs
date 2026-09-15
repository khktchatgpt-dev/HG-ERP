// ĐƯA TỒN KHO VỀ 0 BẰNG PHIẾU KIỂM KÊ (15/09/2026, chủ dự án yêu cầu).
//
//   node scripts/kho-ve-0-0915.mjs           # DRY-RUN
//   node scripts/kho-ve-0-0915.mjs --apply   # ghi thật
//
// Bối cảnh: phòng Cung ứng đang nhập lại dữ liệu từ đầu, nên tồn kho cũ phải
// về 0 để số nhập mới không cộng dồn lên số cũ.
//
// VÌ SAO LẬP PHIẾU CHỨ KHÔNG XOÁ. Tồn kho KHÔNG phải số lưu sẵn — nó là tổng
// các dòng phiếu nhập xuất (`warehouse_stock` là view). Muốn về 0 chỉ có hai
// đường:
//
//   · xoá 149 dòng phiếu — nhưng 142 dòng trong đó đang là bằng chứng NHẬN HÀNG
//     của các đơn mua (`po_line_id`), xoá là 15 đơn "đã nhận" thành "chưa
//     nhận", và đối chiếu ba bên mất một chân;
//   · lập PHIẾU KIỂM KÊ đưa tồn về 0 — giữ nguyên lịch sử, có ghi vết ai làm
//     lúc nào vì sao, và lùi lại được bằng một phiếu ngược.
//
// Chọn đường thứ hai. Đây cũng đúng cách kho thật làm khi kiểm kê đầu kỳ.
//
// Phiếu ghi đủ hai mặt: `warehouse_stocktake_lines` là BIÊN BẢN (số hệ thống,
// số đếm, chênh lệch) để người đọc hiểu; `warehouse_movements` là dòng ĐỘNG
// làm tồn thật sự đổi. Thiếu vế sau thì biên bản đẹp mà tồn không nhúc nhích.
import fs from 'node:fs'
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const HOM_NAY = new Date().toISOString().slice(0, 10)
const BACKUP = 'backup-ton-kho-truoc-kiem-ke-20260915.json'

const db = await client(import.meta.url)

const ton = []
for (let f = 0; ; f += 1000) {
  const { data, error } = await db
    .from('warehouse_stock')
    .select('material_id, code, name, unit, on_hand')
    .neq('on_hand', 0)
    .range(f, f + 999)
  if (error) throw new Error(error.message)
  ton.push(...data)
  if (data.length < 1000) break
}
const duong = ton.filter((t) => Number(t.on_hand) > 0)
const am = ton.filter((t) => Number(t.on_hand) < 0)

console.log(
  `\n${APPLY ? '⚙ GHI THẬT' : '🔍 DRY-RUN (chưa ghi gì)'} — kiểm kê đưa tồn về 0\n`,
)
console.log(`  vật tư đang có tồn : ${ton.length}`)
console.log(
  `    · tồn dương      : ${duong.length} — tổng ${Math.round(duong.reduce((a, b) => a + Number(b.on_hand), 0)).toLocaleString('vi-VN')}`,
)
console.log(
  `    · tồn âm         : ${am.length}${am.length ? ' (sẽ ghi dòng NHẬP để kéo lên 0)' : ''}`,
)
for (const t of [...duong]
  .sort((a, b) => Number(b.on_hand) - Number(a.on_hand))
  .slice(0, 8))
  console.log(
    `      ${String(t.code ?? '').padEnd(14)} ${String(t.name ?? '')
      .slice(0, 40)
      .padEnd(
        42,
      )} ${Number(t.on_hand).toLocaleString('vi-VN').padStart(10)} ${t.unit ?? ''}`,
  )
if (duong.length > 8) console.log(`      … còn ${duong.length - 8} vật tư`)

// Số phiếu kiểm kê kế tiếp — dùng đúng bộ đếm của hệ thống.
const { data: dem } = await db
  .from('doc_counters')
  .select('kind, year, last_no')
  .eq('kind', 'KK')
  .eq('year', 2026)
  .maybeSingle()
const so = (dem?.last_no ?? 0) + 1
const code = `KK-2026-${String(so).padStart(4, '0')}`
console.log(`\n  phiếu sẽ lập: ${code} · ${ton.length} dòng`)

if (!APPLY) {
  console.log('\nChạy lại với --apply để ghi.\n')
  process.exit(0)
}

fs.writeFileSync(
  BACKUP,
  JSON.stringify(
    {
      taken_at: new Date().toISOString(),
      why: 'Tồn kho TRƯỚC khi lập phiếu kiểm kê đưa về 0 (15/09/2026).',
      restore:
        'Lập một phiếu kiểm kê ngược: mỗi vật tư một dòng NHẬP đúng số on_hand dưới đây.',
      ton,
    },
    null,
    1,
  ),
)
console.log(`  ✓ đã sao lưu tồn hiện tại → ${BACKUP}`)

const { data: kho } = await db.from('warehouses').select('id').limit(1).maybeSingle()
const { data: doc, error: e1 } = await db
  .from('warehouse_docs')
  .insert({
    code,
    kind: 'stocktake',
    doc_date: HOM_NAY,
    status: 'posted',
    reason: 'Kiểm kê đầu kỳ — đưa tồn về 0 để nhập lại dữ liệu',
    note:
      'Phòng Cung ứng nhập lại dữ liệu từ đầu nên tồn cũ phải về 0, tránh số mới cộng dồn lên số cũ. ' +
      `Sao lưu tồn trước khi kiểm kê ở ${BACKUP}.`,
  })
  .select('id, code')
  .single()
if (e1) throw new Error('phiếu: ' + e1.message)

const mv = ton.map((t) => ({
  material_id: t.material_id,
  direction: Number(t.on_hand) > 0 ? 'out' : 'in',
  qty: Math.abs(Number(t.on_hand)),
  qty_rejected: 0,
  ref_type: 'adjust',
  ref_no: code,
  doc_id: doc.id,
  warehouse_id: kho?.id ?? null,
  note: `Kiểm kê đưa tồn về 0. Tồn trước kiểm kê: ${Number(t.on_hand)}`,
}))
const bb = ton.map((t) => ({
  doc_id: doc.id,
  material_id: t.material_id,
  system_qty: Number(t.on_hand),
  counted_qty: 0,
  diff: -Number(t.on_hand),
  note: 'Đưa về 0 để nhập lại dữ liệu',
}))

for (let i = 0; i < mv.length; i += 200) {
  const e = (await db.from('warehouse_movements').insert(mv.slice(i, i + 200))).error
  if (e) throw new Error('dòng động: ' + e.message)
}
for (let i = 0; i < bb.length; i += 200) {
  const e = (await db.from('warehouse_stocktake_lines').insert(bb.slice(i, i + 200)))
    .error
  if (e) throw new Error('biên bản: ' + e.message)
}
await db.from('doc_counters').upsert({ kind: 'KK', year: 2026, last_no: so })

const { count } = await db
  .from('warehouse_stock')
  .select('material_id', { count: 'exact', head: true })
  .neq('on_hand', 0)
console.log(`  + ${doc.code} — ${mv.length} dòng động, ${bb.length} dòng biên bản`)
console.log(`  còn lại vật tư có tồn khác 0: ${count}`)
console.log('\n✓ Xong.\n')
