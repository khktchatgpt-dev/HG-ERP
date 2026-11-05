/**
 * Tờ "Số ĐH: 01 HG/HT · LSX 13/26+27 (18086)" ngày 21/10/2026 — khớp nối chân nhôm
 * đúc mua theo kg, Cơ khí Hoài Thương. Lên NHÁP cho chị Nga (21/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-hoai-thuong-lsx13-1021.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-hoai-thuong-lsx13-1021.ts --apply   # ghi
 *
 * Lệnh 13/26-27 - MX là lệnh 18086 HG-MX: Athos 300 + Siena 250 = 550 (dòng 1), Tilos
 * 300 (dòng 2) — khớp SL ĐH trên tờ.
 * Siena dùng NK-0202 "Khớp nối chân nhôm S (nhôm đúc, mua theo kg)" như đơn trước của
 * NCC này (PO-2026-0119). Tilos chưa có mã theo KG (PKN0077 tính theo Cái — nhận kho
 * theo kg sẽ lệch ĐVT) → mở mã mới cùng kiểu NK-0202, đứng tên chị Nga.
 * Tờ không có phần điều khoản (ảnh cắt ở dòng tổng) → chép điều khoản PO-0119 cùng NCC;
 * hẹn giao để trống (thời gian giao tính từ ngày NCC xác nhận).
 * Chạy lại không tạo đôi (chặn theo supplier_doc_no; vật tư theo tên).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const DOC = '01 HG/HT'
const LSX = '13/26-27 - MX'
const TILOS = 'Khớp nối chân nhôm Tilos (nhôm đúc, mua theo kg)'

const DONG = [
  { vt: 'NK-0202', sl: 550, dm: 4, qty: 500, price: 136_000, amount: 68_000_000, note: '1/ 300 ghế 5 bậc Athos\n2/ 250 ghế 5 bậc Siena' }, // prettier-ignore
  { vt: TILOS, sl: 300, dm: 4, qty: 300, price: 136_000, amount: 40_800_000, note: '1/ 300 ghế Tilos' }, // prettier-ignore
]
const TO_HANG = 108_800_000
const TO_TONG = 119_680_000
const vnd = (n: number) => n.toLocaleString('vi-VN')

async function main() {
  for (const l of DONG)
    if (l.qty * l.price !== l.amount) throw new Error(`${l.vt}: ${l.qty * l.price} ≠ tờ ${l.amount}`) // prettier-ignore
  const hang = DONG.reduce((s, l) => s + l.amount, 0)
  const tong = hang + Math.round(hang * 0.1)
  if (hang !== TO_HANG || tong !== TO_TONG)
    throw new Error(`hàng ${hang} / tổng ${tong} ≠ tờ`)
  console.log(`2 dòng · hàng ${vnd(hang)} → +VAT 10% ${vnd(tong)} — khớp tờ`)

  const da = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', DOC) // prettier-ignore
  if (da.data?.length) return console.log(`ĐÃ NẠP tờ ${DOC}: ${da.data[0].code} — dừng.`)

  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  const ncc = (await db().from('supply_suppliers').select('id').eq('code', 'HT').single()).data // prettier-ignore
  const lsx = (await db().from('production_orders').select('id').eq('code', LSX).single()).data // prettier-ignore
  const mau = (await db().from('supply_purchase_orders').select('terms_quality,terms_delivery_place,terms_payment,terms_invoice,terms_lead_time,signer_role').eq('code', 'PO-2026-0119').single()).data // prettier-ignore
  if (!ncc || !lsx || !mau) throw new Error('thiếu NCC HT / lệnh / đơn mẫu PO-0119')

  // Lệnh phải có đúng các ghế ghi chú trên tờ.
  const { data: pol } = await db().from('production_order_lines').select('name_vi,qty').eq('production_order_id', lsx.id) // prettier-ignore
  const sl = (ten: string) => pol?.find((x) => x.name_vi?.includes(ten))?.qty
  if (sl('Athos') !== 300 || sl('Siena') !== 250 || sl('Tilos') !== 300)
    throw new Error(`lệnh không khớp: Athos ${sl('Athos')} Siena ${sl('Siena')} Tilos ${sl('Tilos')}`) // prettier-ignore
  console.log(`Lệnh ${LSX}: Athos 300 · Siena 250 · Tilos 300 — khớp`)

  const s = (await db().from('warehouse_materials').select('id,unit').eq('code', 'NK-0202').single()).data // prettier-ignore
  if (!s || s.unit !== 'Kg') throw new Error('NK-0202 không còn / không theo Kg')
  const t = (await db().from('warehouse_materials').select('id,code').eq('name', TILOS).maybeSingle()).data // prettier-ignore
  console.log(
    `Vật tư: NK-0202 dùng lại · Tilos ${t ? `dùng lại ${t.code}` : 'MỞ MÃ MỚI'}`,
  )
  for (const l of DONG) console.log(`  ${l.vt} | SL ĐH ${l.sl} × Đm ${l.dm} | đặt ${l.qty} Kg × ${vnd(l.price)} = ${vnd(l.amount)} | ${l.note.replace('\n', ' / ')}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const tilosId =
    t?.id ??
    (await materialsService.create(nga, { name: TILOS, unit: 'Kg', group_name: 'Cơ khí - vòng bi - khuôn', material_grade: 'Nhôm đúc', note: 'Mở từ đơn 01 HG/HT (Cơ khí Hoài Thương, 21/10/2026) — cùng kiểu NK-0202 của Siena. PKN0077 "Khớp nối chân ghế Tilos" tính theo Cái.', vat_rate: 10, last_purchase_price: 136_000 })).id // prettier-ignore

  const input = poCreateSchema.parse({
    production_order_id: lsx.id,
    supplier_id: ncc.id,
    template: 'accessory',
    currency: 'VND',
    vat_rate: 10,
    price_includes_vat: false,
    ...mau,
    lines: DONG.map((l) => ({
      material_id: l.vt === 'NK-0202' ? s.id : tilosId,
      qty_ordered: l.qty,
      unit_price: l.price,
      material_grade: 'Nhôm đúc',
      dm_per_sp: l.dm,
      qty_demand: l.sl,
      note: l.note,
    })),
  })
  const po = await posService.create(nga, input)
  const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: DOC }).eq('id', po.id) // prettier-ignore
  if (error) throw new Error(`số tờ: ${error.message}`)
  console.log(`✓ ${po.code} (nháp) — ${DOC}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
