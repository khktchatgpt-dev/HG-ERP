/**
 * ĐƠN BĂNG KEO CƯỜNG LỰC — CÔNG TY TNHH PHƯỚC KHANG, LSX 6+8+9 (HG-MX) (ảnh tờ đơn, 06/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-phuoc-khang-1006.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-phuoc-khang-1006.ts --apply   # ghi
 *
 * Tờ: Số ĐH 1/2026- HG/TN · LSX 6+8+9 (HG-MX) · 2 dòng · VAT 8% → 84.569.400. Lên NHÁP cho chị Nga.
 * Chủ dự án chốt (06/10):
 *  · NCC Phước Khang CHƯA có → tạo mới, mã PK (MST, địa chỉ, người liên hệ theo tờ).
 *  · Dòng 2 "GT7117" KHÔNG có trong danh mục (chỉ có GT7116 khổ 15mm) → tạo mã mới
 *    KEO0133 "Băng keo cường lực GT7117 15mmx33m", không coi là ghi nhầm.
 * Dòng 1 GT7116 10x33mm = KEO0020. Ô Ghi chú trên tờ gộp hai dòng → ghi ở dòng 1.
 * Tờ không ghi hẹn giao / điều khoản → để trống cho chị Nga điền. Tạo qua service
 * (posService/materialsService/suppliersService) đứng tên chị Nga; chống nạp đôi theo số ĐH.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { suppliersService } from '@/modules/dept/supply/suppliers.service'
import { supplierCreateSchema } from '@/modules/dept/supply/suppliers.schema'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { canAction } from '@/modules/core/rbac/rbac.service'

const APPLY = process.argv.includes('--apply')
const SO_DH = '1/2026- HG/TN'
const MST = '0303645494'
const MA_MOI = 'KEO0133'

async function one<T>(q: PromiseLike<{ data: T[] | null }>): Promise<T | null> {
  const { data } = await q
  return data?.[0] ?? null
}

async function main() {
  // Số trên tờ phải khớp tới đồng trước khi ghi.
  const d1 = 193 * 329_000
  const d2 = 30 * 493_600
  const hang = d1 + d2
  const vat = Math.round(hang * 0.08)
  if (
    d1 !== 63_497_000 ||
    d2 !== 14_808_000 ||
    hang !== 78_305_000 ||
    vat !== 6_264_400 ||
    hang + vat !== 84_569_400
  )
    // prettier-ignore
    throw new Error(`lệch tờ: ${d1} / ${d2} / ${hang} / ${vat}`)
  console.log(`Tiền hàng ${hang.toLocaleString('vi-VN')} + VAT 8% ${vat.toLocaleString('vi-VN')} = ${(hang + vat).toLocaleString('vi-VN')} — khớp tờ`) // prettier-ignore

  const da = await one(db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', SO_DH)) // prettier-ignore
  if (da) return console.log(`ĐÃ NẠP: ${(da as { code: string }).code} — dừng.`)

  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  for (const k of [
    'supply.supplier.manage',
    'warehouse.material.create',
    'supply.po.manage',
  ] as const)
    // prettier-ignore
    if (!(await canAction(nga, k))) throw new Error(`chị Nga thiếu quyền ${k}`)

  const lsx = new Map<string, string>()
  for (const c of ['06/26-27 - MX', '08/26-27 - MX', '09/26-27 - MX']) {
    const r = await one(db().from('production_orders').select('id').eq('code', c))
    if (!r) throw new Error(`không thấy lệnh ${c}`)
    lsx.set(c, (r as { id: string }).id)
  }
  const keo0020 = await one(db().from('warehouse_materials').select('id,name,unit').eq('code', 'KEO0020')) // prettier-ignore
  if (!keo0020) throw new Error('không thấy KEO0020')

  // NCC + mã mới: có sẵn (lần chạy trước dừng giữa chừng) thì dùng lại, không tạo đôi.
  const nccCo = await one(
    db().from('supply_suppliers').select('id,code').eq('tax_no', MST),
  )
  const vtCo = await one(
    db().from('warehouse_materials').select('id,code').eq('code', MA_MOI),
  )
  console.log(`NCC: ${nccCo ? `dùng lại ${(nccCo as { code: string }).code}` : 'TẠO MỚI PK — Công ty TNHH Phước Khang'}`) // prettier-ignore
  console.log(`Vật tư dòng 2: ${vtCo ? `dùng lại ${MA_MOI}` : `TẠO MỚI ${MA_MOI} — Băng keo cường lực GT7117 15mmx33m (Cuộn)`}`) // prettier-ignore
  console.log(
    `Dòng 1: KEO0020 ${(keo0020 as { name: string }).name} · 193 Cuộn × 329.000`,
  )
  console.log(`Dòng 2: ${MA_MOI} · 30 Cuộn × 493.600 (SL đơn hàng 33, tồn 3)`)
  console.log(`Lệnh: 06/26-27 - MX (+ 08, 09) · số ĐH ${SO_DH} · người lập ${nga.name}`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const nccId = nccCo
    ? (nccCo as { id: string }).id
    : (
        await suppliersService.create(
          nga,
          supplierCreateSchema.parse({
            code: 'PK',
            name: 'Công ty TNHH Phước Khang',
            short_name: 'Phước Khang',
            tax_no: MST,
            address: 'D39 đường Phú Thuận, KDC Nam Long, KP2, Phú Nhuận, TP.HCM',
            phone: '0933.002.897 (C. Chu)',
            contact_phone: '0933.002.897',
          }),
        )
      ).id
  const vtId = vtCo
    ? (vtCo as { id: string }).id
    : (
        await materialsService.create(nga, {
          code: MA_MOI,
          name: 'Băng keo cường lực GT7117 15mmx33m',
          unit: 'Cuộn',
          spec: '15mm×33m',
          group_name: 'Bao bì - đóng gói - tem nhãn',
          sub_group: 'Băng keo - dây đai - dây rút - pallet',
        })
      ).id

  const input = poCreateSchema.parse({
    production_order_id: lsx.get('06/26-27 - MX'),
    extra_lsx_ids: [lsx.get('08/26-27 - MX'), lsx.get('09/26-27 - MX')],
    supplier_id: nccId,
    template: 'accessory',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    lines: [
      {
        material_id: (keo0020 as { id: string }).id,
        qty_ordered: 193,
        unit_price: 329_000,
        spec: '10x33mm',
        qty_demand: 193,
        qty_on_hand: 0,
        note: '1/ 350 Bàn NK 80(120)\n2/ 190 Bàn NK 150(220)\n3/ 160 Bàn NK 200(300)\n4/ 80 Bàn NK 220(340)',
      },
      {
        material_id: vtId,
        qty_ordered: 30,
        unit_price: 493_600,
        spec: '15x33mm',
        qty_demand: 33,
        qty_on_hand: 3,
      },
    ],
  })
  const po = await posService.create(nga, input)
  const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id) // prettier-ignore
  if (error) throw new Error(`số ĐH: ${error.message}`)
  console.log(`✓ ${po.code} (nháp) · NCC ${nccCo ? 'cũ' : 'PK mới'} · ${MA_MOI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
