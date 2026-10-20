// ĐỒNG BỘ GHI CHÚ LÀM TRÒN cho các đơn nạp 18/09/2026.
//
//   node scripts/don-truyen-0918-ghi-chu-lech.mjs           # DRY-RUN
//   node scripts/don-truyen-0918-ghi-chu-lech.mjs --apply
//
// Tính lại tiền đơn ĐÚNG công thức poLineAmount của app (price_basis 'unit2' thì
// lấy qty2 × đơn giá), so với số in trên tờ, rồi:
//   · còn lệch  → gắn ghi chú LÀM TRÒN (nếu chưa có)
//   · hết lệch  → GỠ ghi chú cũ đi
//
// Cần bước gỡ vì bản đầu tôi gắn ghi chú cho 3 đơn, sau đó
// don-truyen-0918-sua-gia-kg.mjs chuyển chúng sang giá theo kg và hai trong ba
// đơn hết lệch — để ghi chú lại thì tờ đơn tự nói dối về chính nó.
import { client } from './products-lib.mjs'

const APPLY = process.argv.includes('--apply')
const DAU = ' LÀM TRÒN:'

// mã đơn → tiền hàng in trên tờ
const TREN_TO = {
  'PO-2026-0073': 116313300,
  'PO-2026-0074': 95010000,
  'PO-2026-0075': 363968000,
  'PO-2026-0076': 72600000,
  'PO-2026-0077': 48409200,
  'PO-2026-0078': 252414880,
  'PO-2026-0079': 9960000,
  'PO-2026-0080': 49089180,
  'PO-2026-0081': 3996000,
  'PO-2026-0082': 112358552,
}

const db = await client(import.meta.url)
console.log(APPLY ? '⚙ GHI THẬT\n' : '🔍 DRY-RUN (chưa ghi gì)\n')

for (const [code, to] of Object.entries(TREN_TO)) {
  const { data: po } = await db
    .from('supply_purchase_orders')
    .select('id, code, note')
    .eq('code', code)
    .maybeSingle()
  if (!po) throw new Error(`không thấy ${code}`)
  const { data: ln } = await db
    .from('supply_purchase_order_lines')
    .select('qty_ordered, qty2, unit_price, price_basis')
    .eq('po_id', po.id)

  const may =
    Math.round(
      ln.reduce(
        (a, l) =>
          a +
          (l.price_basis === 'unit2'
            ? Number(l.qty2 ?? 0) * Number(l.unit_price)
            : Number(l.qty_ordered) * Number(l.unit_price)),
        0,
      ) * 100,
    ) / 100
  const lech = Math.round((may - to) * 100) / 100
  const dangCo = po.note?.includes(DAU) ?? false
  const sach = dangCo ? po.note.slice(0, po.note.indexOf(DAU)) : (po.note ?? '')

  if (lech === 0) {
    if (!dangCo) {
      console.log(
        `  ok ${code}  ${may.toLocaleString('vi-VN')}đ — khớp tờ, không ghi chú`,
      )
      continue
    }
    console.log(
      `  − ${code}  nay đã khớp (${may.toLocaleString('vi-VN')}đ) → GỠ ghi chú cũ`,
    )
    if (APPLY) {
      const { error } = await db
        .from('supply_purchase_orders')
        .update({ note: sach })
        .eq('id', po.id)
      if (error) throw new Error(`${code}: ${error.message}`)
    }
    continue
  }

  const them =
    `${DAU} ô đơn giá chỉ giữ 2 số lẻ, mà đơn giá đơn này chia không hết, nên tổng` +
    ` cộng lại từ các dòng ra ${may.toLocaleString('vi-VN')}đ —` +
    ` ${lech > 0 ? 'hơn' : 'kém'} ${Math.abs(lech).toLocaleString('vi-VN')}đ so với` +
    ` ${to.toLocaleString('vi-VN')}đ in trên tờ. SỐ PHẢI THANH TOÁN LẤY THEO TỜ ĐƠN.`
  console.log(
    `  + ${code}  máy ${may.toLocaleString('vi-VN')} / tờ ${to.toLocaleString('vi-VN')}  (${lech > 0 ? '+' : ''}${lech}đ)`,
  )
  if (APPLY) {
    const { error } = await db
      .from('supply_purchase_orders')
      .update({ note: sach + them })
      .eq('id', po.id)
    if (error) throw new Error(`${code}: ${error.message}`)
  }
}

console.log(APPLY ? '\n✓ Xong.\n' : '\nChạy lại với --apply để ghi.\n')
