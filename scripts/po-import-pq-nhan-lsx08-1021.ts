/**
 * Tờ "ĐH 8-2026/ HG-PQ · LSX 8/ 26-27 (HG-MX)" ngày 21/10/2026 — nhãn hình + thẻ treo
 * tuần cho 5 bàn của lệnh 08/26-27 - MX. Lên NHÁP cho chị Nga (21/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-pq-nhan-lsx08-1021.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-pq-nhan-lsx08-1021.ts --apply   # ghi
 *
 * Chép đúng khuôn đơn PQ số 9 (PO-2026-0099): mẫu Phụ kiện, BAO0483 "Nhãn hình sản
 * phẩm" + THE0020 "Thẻ treo tuần 2 mặt", Mã SP khách vào product_code, SL ĐH → qty_demand,
 * Đm/SP → dm_per_sp, SL đặt = SL ĐH × Đm. 5 mã SP × SL khớp đúng 5 dòng của lệnh.
 * Hẹn giao = mốc cuối "5 đến 7 ngày không tính CN" kể từ 21/10 → 29/10.
 * Chạy lại không tạo đôi (chặn theo supplier_doc_no).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const DOC = 'ĐH 8-2026/ HG-PQ'
const LSX = '08/26-27 - MX'

const NHAN = { code: 'BAO0483', spec: '19.5x7.5cm', grade: 'Giấy Decal 80gr', dm: 2, price: 600 } // prettier-ignore
const THE = { code: 'THE0020', spec: '7x6cm', grade: 'Giấy ĐL 230Gr', dm: 1, price: 320 } // prettier-ignore

// [mã SP khách, SL đơn hàng] theo thứ tự trên tờ — mỗi SP một dòng nhãn + một dòng thẻ.
const SP: [string, number][] = [
  ['26471-217', 50],
  ['26471-219', 90],
  ['26473-217', 120],
  ['26473-219', 40],
  ['26474-217', 80],
]
const TO_HANG = 577_600
const TO_TONG = 623_808

const vnd = (n: number) => n.toLocaleString('vi-VN')

async function main() {
  const lines = SP.flatMap(([sp, sl]) =>
    [NHAN, THE].map((k) => ({ ...k, sp, sl, qty: sl * k.dm })),
  )
  const hang = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const tong = hang + Math.round(hang * 0.08)
  if (hang !== TO_HANG || tong !== TO_TONG)
    throw new Error(`hàng ${hang} / tổng ${tong} ≠ tờ ${TO_HANG} / ${TO_TONG}`)
  console.log(`${lines.length} dòng · hàng ${vnd(hang)} → +VAT 8% ${vnd(tong)} — khớp tờ`)

  const da = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', DOC) // prettier-ignore
  if (da.data?.length) return console.log(`ĐÃ NẠP tờ ${DOC}: ${da.data[0].code} — dừng.`)

  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  const ncc = (await db().from('supply_suppliers').select('id').eq('code', 'PQ').single()).data // prettier-ignore
  const lsx = (await db().from('production_orders').select('id').eq('code', LSX).single()).data // prettier-ignore
  if (!ncc || !lsx) throw new Error('thiếu NCC PQ hoặc lệnh')
  const { data: mats } = await db().from('warehouse_materials').select('id,code').in('code', [NHAN.code, THE.code]) // prettier-ignore
  const matId = new Map((mats ?? []).map((m) => [m.code, m.id]))
  if (matId.size !== 2) throw new Error('thiếu mã vật tư')

  // Lệnh phải có đúng 5 mã SP × SL như tờ.
  const { data: pol } = await db().from('production_order_lines').select('customer_item_code,qty').eq('production_order_id', lsx.id) // prettier-ignore
  for (const [sp, sl] of SP) {
    const r = pol?.find((x) => x.customer_item_code === sp)
    if (!r || Number(r.qty) !== sl) throw new Error(`lệnh không khớp ${sp} × ${sl}`)
  }
  console.log(`Lệnh ${LSX}: 5/5 mã SP khớp SL`)
  for (const l of lines)
    console.log(`  ${l.sp} ${l.code} SL ĐH ${l.sl} × ${l.dm} = ${l.qty} × ${l.price} = ${vnd(l.qty * l.price)}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const input = poCreateSchema.parse({
    production_order_id: lsx.id,
    supplier_id: ncc.id,
    template: 'accessory',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    expected_at: '2026-10-29',
    terms_quality: 'Giao hàng đúng chủng loại, đúng kích thước như trên đơn hàng.',
    terms_delivery_place:
      'Xưởng SX Cty TNHH Hoàng Gia - Cụm CN Cát Nhơn, Xã Xuân An, Tỉnh Gia Lai',
    terms_payment: 'Công nợ cuối tháng.',
    terms_invoice: 'Hóa đơn GTGT',
    terms_lead_time:
      'Giao hàng từ 5 đến 7 ngày kể từ ngày nhận ĐH.( không tính ngày lễ và chủ nhật)',
    signer_role: 'NGƯỜI LẬP',
    lines: lines.map((l) => ({
      material_id: matId.get(l.code),
      qty_ordered: l.qty,
      unit_price: l.price,
      spec: l.spec,
      material_grade: l.grade,
      product_code: l.sp,
      note: l.sp, // mã SP khách không có cột trên màn/phiếu → user bảo ghi vào Ghi chú
      dm_per_sp: l.dm,
      qty_demand: l.sl,
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
