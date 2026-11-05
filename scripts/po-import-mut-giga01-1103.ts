/**
 * Tờ "ĐƠN ĐẶT HÀNG Số 09 HG/HVH · LSX 26-17656, LSX 37.17718" — Mousse D20 cắt theo rập,
 * màu trắng, của anh Hưng (Hàn Việt Hải — trong danh mục lưu là "Tập đoàn Nệm Kim Cương",
 * như các đơn 1/2026-HG/HVH, 2/2026-HG/HVH trước). Lệnh 01/26-27 - GIGA, mẫu XỐP tính
 * theo m³. Lên NHÁP đứng tên chị Nga (03/11/2026, user nhờ tạo vì chị không tìm ra mã:
 * danh mục đặt tên "Mút D20 …", gõ "Mousse" không ra).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-mut-giga01-1103.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-mut-giga01-1103.ts --apply   # ghi
 *
 * Số trên tờ: Tổng m³ 97,373 · thành tiền 185.009.318 (giá 1.900.000 đ/m³, chưa thấy dòng VAT
 * trên tờ — để VAT 8% chưa gồm như các đơn HVH trước, chị Nga sửa nếu khác).
 * Chạy lại không tạo đôi (chặn theo supplier_doc_no).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const DOC = '09 HG/HVH'
const LSX = '01/26-27 - GIGA'
const SUPPLIER_ID = 'b95841af-2999-4019-9492-b68fc56d9c91' // TẬP ĐOÀN NỆM KIM CƯƠNG (anh Hưng 0927872727)
const GIA_M3 = 1_900_000

/** Ba dòng đúng tờ: mã danh mục có sẵn từ 02/08 (KHÔNG dùng XM-0122 tạo trùng sáng 03/11). */
const DONG = [
  { ma: 'MUT0206', d: [725, 695, 140], sl: 620, sp: 620, dm: 1, note: '620 ghế Bank 1 20x80', m3: 43.736, tien: 83_099_065 }, // prettier-ignore
  { ma: 'MUT0201', d: [1315, 730, 140], sl: 115, sp: 115, dm: 1, note: '115 ghế Bank 2', m3: 15.455, tien: 29_364_871 }, // prettier-ignore
  { ma: 'MUT0208', d: [945, 740, 140], sl: 390, sp: 195, dm: 2, note: '195 ghế bank 3', m3: 38.182, tien: 72_545_382 }, // prettier-ignore
]
const vnd = (n: number) => n.toLocaleString('vi-VN')

async function main() {
  // Đối chiếu tờ trước khi đụng DB: m³ (3 số lẻ) và thành tiền (làm tròn đồng).
  let tongM3 = 0
  let tongTien = 0
  for (const x of DONG) {
    const m3 = (x.d[0] * x.d[1] * x.d[2] * x.sl) / 1e9
    const tien = Math.round(m3 * GIA_M3)
    if (Math.abs(m3 - x.m3) > 0.0005) throw new Error(`${x.ma}: m³ ${m3} ≠ tờ ${x.m3}`)
    if (tien !== x.tien) throw new Error(`${x.ma}: tiền ${tien} ≠ tờ ${x.tien}`)
    if (x.sp * x.dm !== x.sl) throw new Error(`${x.ma}: ${x.sp} × ${x.dm} ≠ ${x.sl}`)
    tongM3 += m3
    tongTien += tien
  }
  if (Math.abs(tongM3 - 97.373) > 0.0005 || tongTien !== 185_009_318)
    throw new Error(`tổng ${tongM3} m³ / ${tongTien} ≠ tờ`)
  console.log(`3 dòng · ${tongM3.toFixed(3)} m³ · ${vnd(tongTien)} đ (chưa VAT) — khớp tờ`)

  const da = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', DOC) // prettier-ignore
  if (da.data?.length) return console.log(`ĐÃ NẠP tờ ${DOC}: ${da.data[0].code} — dừng.`)

  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  const lsx = (await db().from('production_orders').select('id, status').eq('code', LSX).single()).data // prettier-ignore
  if (!lsx) throw new Error(`thiếu lệnh ${LSX}`)
  const { data: mats, error } = await db()
    .from('warehouse_materials')
    .select('id, code, name, unit, spec, is_active')
    .in('code', DONG.map((x) => x.ma))
  if (error) throw new Error(error.message)
  const byCode = new Map((mats ?? []).map((m) => [m.code, m]))
  for (const x of DONG) {
    const m = byCode.get(x.ma)
    if (!m || !m.is_active) throw new Error(`thiếu / ngưng ${x.ma}`)
    console.log(`  ${m.code} ${m.name} (${m.unit}) | ${x.d.join('×')} | ${x.sl} tấm | ${vnd(GIA_M3)}/m³ | ${x.note}`) // prettier-ignore
  }
  console.log(`Lệnh ${LSX} (${lsx.status}) · NCC Nệm Kim Cương · người lập ${nga.name}`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const input = poCreateSchema.parse({
    production_order_id: lsx.id,
    supplier_id: SUPPLIER_ID,
    template: 'foam',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    note: 'Theo tờ đơn Số 09 HG/HVH — LSX 26-17656, LSX 37.17718. Mousse D20 cắt theo rập, màu trắng.',
    // Điều khoản chép từ đơn HVH gần nhất của chị Nga (PO-2026-0164).
    terms_quality: 'Đúng quy cách.',
    terms_delivery_place: 'CÔNG TY TNHH SX-TM HOÀNG GIA - Lô C3, Cụm CN Cát Nhơn, Xã Xuân An, Gia Lai', // prettier-ignore
    terms_payment: 'Công nợ 30 ngày — giá bốc tại kho NCC, chưa gồm vận chuyển',
    terms_invoice: 'Hóa đơn GTGT',
    terms_lead_time: 'Từ 5 đến 7 ngày kể từ ngày nhận đơn',
    lines: DONG.map((x) => ({
      material_id: byCode.get(x.ma)!.id,
      qty_ordered: x.sl,
      unit_price: GIA_M3,
      carton_basis: 'm3',
      spec: x.d.join('x'),
      inner_l_mm: x.d[0],
      inner_w_mm: x.d[1],
      inner_h_mm: x.d[2],
      qty_demand: x.sp,
      dm_per_sp: x.dm,
      note: x.note,
    })),
  })
  const po = await posService.create(nga, input)
  const { error: e2 } = await db().from('supply_purchase_orders').update({ supplier_doc_no: DOC }).eq('id', po.id) // prettier-ignore
  if (e2) throw new Error(`số tờ: ${e2.message}`)
  console.log(`✓ ${po.code} (nháp) — ${DOC}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
