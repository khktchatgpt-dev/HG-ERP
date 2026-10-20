// ĐIỀN Ô QUY ĐỔI cho các đơn nạp 18/09/2026, để MÀN CHI TIẾT tính đúng.
//
//   node scripts/don-truyen-0918-quy-doi.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-quy-doi.mjs --apply
//
// VÌ SAO CẦN. Hai màn của app tính tiền dòng theo hai đường khác nhau:
//   · Màn DANH SÁCH (posRepo.totalsByPoIds) đọc thẳng price_basis + qty2 từ DB.
//   · Màn CHI TIẾT (DonChungTuScreen → lineFromPo → deriveLine) KHÔNG đọc cột
//     qty2; nó TÍNH LẠI từ các ô quy đổi của mẫu. Mẫu 'aluminium' cần
//     weight_per_m × bar_length_m × SL; mẫu 'metal_kg' cần weight_per_unit × SL.
// Nạp thẳng vào DB mà bỏ trống các ô đó thì chi tiết rơi về SL × đơn giá — hiện
// 141 × 121.000 = 17.061.000 thay vì 300kg × 121.000, và gắn cờ "thiếu số".
//
// CÁCH ĐIỀN: suy ngược từ qty2 đã đúng (weight_per_m = qty2 ÷ dài ÷ SL) chứ
// không chép kg/m ghi trên tờ — làm vậy sai số nhỏ nhất. Với phần lớn đơn, hai
// cách cho ra cùng một số vì kg/m trên tờ vốn đã tròn (0,204 · 0,255 · 0,384).
//
// HAI ĐƠN ĐỔI MẪU: Cát Tường (nhôm TẤM) và Quang Minh (hàng ép khuôn, cây 3m)
// đang để mẫu 'aluminium' vốn đòi "dài cây × kg/m" — vô nghĩa với tấm. Chuyển
// sang 'metal_kg' (kg mỗi đơn vị × SL), đúng hình dạng dữ liệu của chúng.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const r4 = (n) => Math.round(n * 1e4) / 1e4

// Hai đơn cần đổi mẫu sang metal_kg (chỉ cần weight_per_unit).
const DOI_MAU = { 'PO-2026-0079': 'metal_kg', 'PO-2026-0081': 'metal_kg' }
const MA = [
  'PO-2026-0075',
  'PO-2026-0076',
  'PO-2026-0077',
  'PO-2026-0078',
  'PO-2026-0079',
  'PO-2026-0080',
  'PO-2026-0081',
]

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

for (const code of MA) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, template')
    .eq('code', code)
    .maybeSingle()
  if (!po) throw new Error(`không thấy ${code}`)
  const mau = DOI_MAU[code] ?? po.template

  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('id, sort_order, line_name, qty_ordered, qty2, unit_price, bar_length_m')
    .eq('po_id', po.id)
    .order('sort_order')

  console.log(
    `  ${code}  mẫu ${po.template}${mau !== po.template ? ` → ${mau}` : ''}  ${ln.length} dòng`,
  )
  let lechTien = 0
  for (const l of ln) {
    const sl = Number(l.qty_ordered)
    const kg = Number(l.qty2)
    const dai = l.bar_length_m != null ? Number(l.bar_length_m) : null
    const patch = {}
    let kgTinhLai

    if (mau === 'metal_kg') {
      const kgMoi = r4(kg / sl)
      patch.weight_per_unit = kgMoi
      kgTinhLai = r4(kgMoi * sl)
    } else {
      if (!dai || dai <= 0)
        throw new Error(`${code} #${l.sort_order}: mẫu nhôm mà thiếu dài cây`)
      const kgm = r4(kg / (dai * sl))
      patch.weight_per_m = kgm
      kgTinhLai = r4(kgm * dai * sl)
    }
    const d = r4(kgTinhLai - kg)
    lechTien += d * Number(l.unit_price)
    console.log(
      `    #${l.sort_order} ${String(l.line_name ?? '')
        .slice(0, 34)
        .padEnd(36)}` +
        ` ${String(sl).padStart(4)} × ${dai ? dai + 'm × ' : ''}` +
        `${(patch.weight_per_m ?? patch.weight_per_unit).toString().padStart(8)}` +
        ` = ${kgTinhLai.toString().padStart(10)} kg` +
        (d === 0 ? '  ✓ khớp' : `  ⚠ lệch ${d > 0 ? '+' : ''}${d} kg`),
    )
    if (!APPLY) continue
    const { error } = await db
      .from('supply_purchase_order_lines')
      .update(patch)
      .eq('id', l.id)
    if (error) throw new Error(`${code} #${l.sort_order}: ${error.message}`)
  }
  if (Math.abs(lechTien) >= 1)
    console.log(
      `    → màn chi tiết sẽ hiện lệch ${Math.round(lechTien).toLocaleString('vi-VN')}đ so với tờ` +
        ` (NCC ghi tổng kg tròn, không phải tích đúng của kg/m × dài × SL)`,
    )
  if (APPLY && mau !== po.template) {
    const { error } = await db
      .from('supply_purchase_orders')
      .update({ template: mau })
      .eq('id', po.id)
    if (error) throw new Error(`${code} đổi mẫu: ${error.message}`)
  }
  console.log()
}

console.log(APPLY ? '✓ Xong.\n' : 'Chạy lại với --apply để ghi.\n')
