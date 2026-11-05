/**
 * Tờ "Số ĐH: 1/2026- HG/TV · LSX 11/26-27 (HG-MX)" — vải CDTV1178 của Công ty Dệt Thái Vi,
 * mẫu đơn VẢI (fabric: đặt theo mét, SL đơn hàng × Đm/sp). Lên NHÁP đứng tên chị Nga.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-thai-vi-lsx11-1026.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-thai-vi-lsx11-1026.ts --apply   # ghi
 *
 * SL cần đặt 500 m là số ghi trên tờ (không phải 700 × 0,45 = 315 m). Hàng 500 m × 50.000 = 25.000.000,
 * GTGT 8% = 2.000.000, tổng 27.000.000 — khớp tờ.
 * Chạy lại không tạo đôi (chặn theo supplier_doc_no).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const DOC = '1/2026- HG/TV'
const LSX = '11/26-27 - MX'
const SUPPLIER_ID = 'c8304b1b-318a-46e0-a059-05b06b7d143e' // CÔNG TY DỆT THÁI VI
const MATERIAL_ID = 'b8554b71-ca26-4c4d-9afd-15fabf4fcca9' // MA-0047 VẢI CDTV1178

const DONG = {
  sl: 700,
  dm: 0.45,
  qty: 500,
  price: 50_000,
  amount: 25_000_000,
  grade: 'CD 230 GR UV 48H',
  note: '1/ 700 Nệm Ghế Lugano',
}
const THUE = 0.08
const vnd = (n: number) => n.toLocaleString('vi-VN')

async function main() {
  if (DONG.qty * DONG.price !== DONG.amount)
    throw new Error(`${DONG.qty} × ${DONG.price} ≠ ${DONG.amount}`)
  const thue = Math.round(DONG.amount * THUE)
  const tong = DONG.amount + thue
  if (thue !== 2_000_000 || tong !== 27_000_000)
    throw new Error(`thuế ${thue} / tổng ${tong} ≠ tờ`)
  console.log(
    `1 dòng · hàng ${vnd(DONG.amount)} → +GTGT 8% ${vnd(thue)} = ${vnd(tong)} — khớp tờ`,
  )

  const da = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', DOC) // prettier-ignore
  if (da.data?.length) return console.log(`ĐÃ NẠP tờ ${DOC}: ${da.data[0].code} — dừng.`)

  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  const lsx = (await db().from('production_orders').select('id').eq('code', LSX).single()).data // prettier-ignore
  if (!lsx) throw new Error(`thiếu lệnh ${LSX}`)
  const mat = (await db().from('warehouse_materials').select('id,code,unit').eq('id', MATERIAL_ID).single()).data // prettier-ignore
  if (!mat) throw new Error('thiếu MA-0047')
  console.log(
    `Lệnh ${LSX} · NCC Dệt Thái Vi · vật tư ${mat.code} (${mat.unit ?? 'ĐVT ?'})`,
  )
  console.log(
    `  ${mat.code} | SL ĐH ${DONG.sl} × Đm ${DONG.dm} | đặt ${DONG.qty} m × ${vnd(DONG.price)} = ${vnd(DONG.amount)} | ${DONG.grade} | ${DONG.note}`,
  )
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const input = poCreateSchema.parse({
    production_order_id: lsx.id,
    supplier_id: SUPPLIER_ID,
    template: 'fabric',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    terms_quality: 'Đúng mẫu, đúng chuẩn loại như trên đơn hàng.',
    terms_delivery_place: 'Chành xe hùng vịnh - QL 1A, Q12, TP.HCM.',
    terms_payment: 'Thanh toán công nợ cuối tháng',
    terms_invoice: 'Hóa đơn GTGT',
    terms_lead_time:
      'Từ 25 đến 30 ngày kể từ ngày xác nhận đơn hàng (không tính ngày lễ và Chủ nhật)',
    lines: [
      {
        material_id: MATERIAL_ID,
        qty_ordered: DONG.qty,
        unit_price: DONG.price,
        material_grade: DONG.grade,
        dm_per_sp: DONG.dm,
        qty_demand: DONG.sl,
        note: DONG.note,
      },
    ],
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
