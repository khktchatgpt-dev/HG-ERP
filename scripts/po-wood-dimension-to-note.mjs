// DỌN Ô "KH GIAO HÀNG" CŨ TRÊN DÒNG ĐƠN GỖ — 03/09/2026.
//
//   node scripts/po-wood-dimension-to-note.mjs            # dò khô
//   node scripts/po-wood-dimension-to-note.mjs --apply    # dời sang ghi chú
//
// Mẫu đơn gỗ từng có cột "KH giao hàng" dùng chung ô `dimension_text`; 03/09
// user chốt bỏ cột đó (đầu phiếu đã có hẹn giao) và thay bằng "Quy cách". Cột
// mới đọc `spec`, nên 43 dòng gỗ cũ vẫn ôm một cái NGÀY trong `dimension_text`
// — không in ra nữa nhưng vẫn hiện khi mở lại đơn để sửa, và nếu mai này ai
// nối lại cột đó thì ngày cũ bò lên phiếu gửi NCC.
//
// Dời sang `note` (nối vào cuối, không đè ghi chú đang có) rồi xoá ô cũ. Chỉ
// đụng dòng mà `dimension_text` TRÔNG NHƯ NGÀY — quy cách thật thì để nguyên,
// nó chính là dữ liệu cột mới cần.

import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
/**
 * Ngày / khoảng ngày: "5/9/2026", "2026-08-24", "25-30/7/2026",
 * "20/08/2026 đến 30//08/2026". Quy cách thì luôn có dấu nhân hoặc đơn vị
 * ("1200x450x18", "18mm", "5 li") — hai họ này không lẫn nhau được.
 */
const isDate = (s) => {
  const t = String(s).trim().toLowerCase()
  if (/[x×]\s*\d|\bmm\b|\bcm\b|\bly\b|\bli\b|\bm3\b/.test(t)) return false
  return /\d{1,2}\s*[/.-]\s*\d{1,2}|\d{4}-\d{2}-\d{2}/.test(t)
}

const sb = await client(import.meta.url)
const { data: pos, error: e1 } = await sb
  .from('supply_purchase_orders')
  .select('id, code')
  .eq('template', 'wood')
if (e1) throw new Error(e1.message)

const { data: lines, error: e2 } = await sb
  .from('supply_purchase_order_lines')
  .select('id, po_id, dimension_text, spec, note, material:warehouse_materials(code)')
  .in(
    'po_id',
    pos.map((p) => p.id),
  )
  .not('dimension_text', 'is', null)
if (e2) throw new Error(e2.message)

const byPo = new Map(pos.map((p) => [p.id, p.code]))
const hits = lines.filter((l) => isDate(l.dimension_text))
for (const l of hits.slice(0, 12))
  console.log(
    `  ${byPo.get(l.po_id)}  ${l.material?.code ?? '?'}  | ${l.dimension_text} → note`,
  )
console.log(
  `\n${hits.length}/${lines.length} dòng gỗ có dimension_text trông như ngày (giữ nguyên ${lines.length - hits.length} dòng quy cách thật)`,
)

if (!APPLY) {
  console.log('\n(dò khô — thêm --apply để ghi)')
} else {
  for (const l of hits) {
    const note = [l.note?.trim(), `KH giao hàng: ${l.dimension_text}`]
      .filter(Boolean)
      .join(' · ')
    const { error } = await sb
      .from('supply_purchase_order_lines')
      .update({ note, dimension_text: null })
      .eq('id', l.id)
    if (error) throw new Error(`${l.id}: ${error.message}`)
  }
  console.log(`\nĐã dời ${hits.length} dòng. Xong.`)
}
