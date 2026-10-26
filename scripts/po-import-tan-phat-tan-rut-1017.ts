/**
 * ĐƠN TÁN RÚT 8x18 — TÂN PHÁT — LSX 2 ROSCO (IBIZA) T11+T12, NHÁP cho chị Nga (17/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-tan-phat-tan-rut-1017.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-tan-phat-tan-rut-1017.ts --apply   # ghi
 *
 * Tờ (ảnh): Số ĐH 2/2026- HG/TP · 4 dòng CÙNG một vật tư "Tán Rút 8x18, 7M" (sắt xi 7 màu),
 * mỗi dòng một SP: SL ĐH × đm/sp = SL đặt · 330 đ/con · VAT 8% → 16.824.931.
 * Mẫu Phụ kiện có sẵn đủ cột (SL đơn hàng · Đm/sp · SL đặt) và cho cùng vật tư nhiều dòng
 * (khác ghi chú = khác dòng, `po-line-dup`). Thứ còn thiếu là MÃ: danh mục chỉ có
 * "Tán rút 8" (BUL0261) không quy cách/vật liệu → mở mã "Tán rút 8x18, 7 màu" theo đúng
 * cách đặt tên "Tán rút 4, 7 màu" (BUL0259), đứng tên chị Nga.
 * Điều khoản chép đơn Tân Phát cùng lệnh PO-2026-0086 (3/2026- HG/TP).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialCreateSchema } from '@/modules/dept/warehouse/warehouse.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const NCC = '106fa686-5248-4f62-af92-65b01545da86' // TP — CÔNG TY TNHH DV & TM TÂN PHÁT
const LSX = '02/26-27 - ROSCO'
const SO_DH = '2/2026- HG/TP'
const VT = {
  name: 'Tán rút 8x18, 7 màu',
  unit: 'Con',
  spec: '8×18',
  material_grade: 'Sắt xi 7 màu',
  group_name: 'Bu lông - vít - đinh - liên kết',
  sub_group: 'Bu lông - tán',
  po_template: 'accessory',
  default_supplier_id: NCC,
  last_purchase_price: 330,
}
const GIA = 330
const DONG = [
  { sp: 952, dm: 24, note: '1/ 952 cái bàn CN Ibiza' },
  { sp: 2_436, dm: 5, note: '1/ 2436 ghế bank 1' },
  { sp: 1_218, dm: 8, note: '1/ 1218 ghế bank 3' },
  { sp: 1_218, dm: 2, note: '1/ 1218 bàn tròn' },
]

async function main() {
  const sl = DONG.map((d) => d.sp * d.dm)
  const hang = sl.reduce((s, q) => s + q * GIA, 0)
  const vat = Math.round(hang * 0.08)
  if (
    sl.join() !== '22848,12180,9744,2436' ||
    hang !== 15_578_640 ||
    hang + vat !== 16_824_931
  )
    throw new Error(`lệch tờ: ${sl} / ${hang} / ${vat}`)
  console.log(`SL đặt ${sl.join(' + ')} = ${sl.reduce((a, b) => a + b, 0)} con · tiền hàng ${hang.toLocaleString('vi-VN')} + VAT ${vat.toLocaleString('vi-VN')} = ${(hang + vat).toLocaleString('vi-VN')} — khớp tờ`) // prettier-ignore

  const { data: da } = await db().from('supply_purchase_orders').select('code').eq('supplier_id', NCC).eq('supplier_doc_no', SO_DH).neq('status', 'cancelled') // prettier-ignore
  if (da?.length)
    return console.log(`ĐÃ NẠP: ${da.map((x) => x.code).join(', ')} — dừng.`)
  const { data: lsx } = await db().from('production_orders').select('id, status').eq('code', LSX).single() // prettier-ignore
  if (!lsx) throw new Error(`không thấy lệnh ${LSX}`)
  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  const { data: co } = await db().from('warehouse_materials').select('id, code').eq('name', VT.name).maybeSingle() // prettier-ignore
  console.log(`Lệnh ${LSX} (${lsx.status}) · NCC Tân Phát · vật tư ${co ? `có sẵn ${co.code}` : `MỚI "${VT.name}"`} · người lập ${nga.name}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const vt = co ?? (await materialsService.create(nga, materialCreateSchema.parse(VT)))
  if (!co) console.log(`+ vật tư ${vt.code}`)
  const po = await posService.create(
    nga,
    poCreateSchema.parse({
      production_order_id: lsx.id,
      supplier_id: NCC,
      template: 'accessory',
      currency: 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      discount_amount: 0,
      terms_quality: 'Đúng mẫu, đúng chuẩn loại như trên đơn hàng.',
      terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
      terms_payment: 'Thanh toán công nợ cuối tháng',
      terms_invoice: 'Hóa đơn GTGT',
      terms_lead_time: 'Hàng Giao theo Kế hoạch, Thời gian giao hàng từ 5 đến 7 ngày.',
      signer_role: 'NGƯỜI LẬP',
      note: 'LSX 2 - ROSCO (IBIZA) - T11+T12',
      lines: DONG.map((d) => ({
        material_id: vt.id,
        material_grade: VT.material_grade,
        spec: '8x18',
        qty_demand: d.sp,
        dm_per_sp: d.dm,
        qty_ordered: d.sp * d.dm,
        unit_price: GIA,
        note: d.note,
      })),
    }),
  )
  const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id) // prettier-ignore
  if (error) throw new Error(`số ĐH: ${error.message}`)
  console.log(`✓ ${po.code} (nháp) — người lập ${nga.name}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
