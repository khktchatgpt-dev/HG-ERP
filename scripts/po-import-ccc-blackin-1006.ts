/**
 * ĐƠN RAY TRƯỢT — PHỤ KIỆN NỘI THẤT CCC, LSX 01/26-27 BLACKIN (ảnh tờ đơn, 06/10/2026).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-ccc-blackin-1006.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-ccc-blackin-1006.ts --apply   # ghi
 *
 * Tờ: Số ĐH 1/2026- HG/HTC · ngày 05/10/2026 · LSX 1.26.27 - BLACKIN · 1 dòng Ray
 * trượt 1050 (352 bộ × 165.000) · VAT 8% → 62.726.400. Lên NHÁP cho chị Nga.
 * Chủ dự án dặn: vật liệu là SẮT MẠ KẼM (tờ ghi nhầm "Nhựa màu đen"); ngày theo tờ
 * mới — đơn 05/10, giao 20/10 (ô "28/09/2026" lạc ngoài bảng là ngày cũ, bỏ).
 * Vật tư NK-0204 (đúng tên tờ, danh mục ghi Thép mạ kẽm), NCC PKNT, lệnh có 352 bàn
 * TB0300HG-IR. Tạo qua `posService.create`; chống nạp đôi theo số ĐH.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { usersRepo } from '@/modules/core/users/users.repo'

const APPLY = process.argv.includes('--apply')
const SO_DH = '1/2026- HG/HTC'

async function id(table: string, code: string): Promise<string> {
  const { data, error } = await db().from(table).select('id').eq('code', code).single()
  if (error || !data) throw new Error(`không thấy ${code}: ${error?.message}`)
  return (data as { id: string }).id
}

async function main() {
  const tien = 352 * 165_000
  if (tien !== 58_080_000) throw new Error(`tiền ${tien} ≠ tờ 58.080.000`)
  console.log(`Tiền hàng ${tien.toLocaleString('vi-VN')} + VAT 8% ${(tien * 0.08).toLocaleString('vi-VN')} = ${(tien * 1.08).toLocaleString('vi-VN')}`) // prettier-ignore
  const { data: da } = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', SO_DH) // prettier-ignore
  if (da?.length)
    return console.log(`ĐÃ NẠP: ${da.map((x) => x.code).join(', ')} — dừng.`)

  const [lsx, ncc, vt] = await Promise.all([
    id('production_orders', '01/26-27 - BLACKIN'),
    id('supply_suppliers', 'PKNT'),
    id('warehouse_materials', 'NK-0204'),
  ])
  const nga = (await usersRepo.list()).find((u) => u.email === 'kehoach1@hoanggia.de')
  if (!nga) throw new Error('thiếu chị Nga')
  const input = poCreateSchema.parse({
    production_order_id: lsx,
    supplier_id: ncc,
    template: 'accessory',
    currency: 'VND',
    vat_rate: 8,
    price_includes_vat: false,
    expected_at: '2026-10-20',
    terms_quality: [
      'Quy cách: như thông tin trên đơn đặt hàng.',
      'Chất lượng: như mẫu đã lấy.',
      'Đóng gói/Bảo quản: đóng thùng hoặc bọc nilon theo từng mã. Ghi KT và SL từng mã cụ thể.',
      'Kiểm tra & giao nhận: kiểm tra theo SL thực tế đóng trên kiện hàng.',
      'Bảo hành – đổi trả: hàng lỗi, sai quy cách đổi trả trong vòng 1 tuần.',
    ].join('\n'),
    terms_delivery_place: 'Tại Công Ty TNHH SX & TM Hoàng Gia',
    terms_payment:
      'Cọc 20%. Xác nhận đơn đặt hàng, SL còn lại thanh toán trong vòng 1 tuần.\nKhối lượng thanh toán: theo số lượng thực nhận và đạt chất lượng.',
    terms_invoice: 'Hoá đơn GTGT',
    terms_lead_time: 'Ngày 20/10/2026',
    note: 'Nạp từ ảnh tờ đơn ngày 06/10/2026. Ngày trên đơn: 05/10/2026. Vật liệu sửa theo chị Nga: sắt mạ kẽm (tờ ghi nhầm "Nhựa màu đen").',
    lines: [
      {
        material_id: vt,
        qty_ordered: 352,
        unit_price: 165_000,
        spec: '35x1050x210x780',
        material_grade: 'Sắt mạ kẽm',
        qty_demand: 352,
        dm_per_sp: 1,
        note: '1/ 352 Bàn Blackin',
      },
    ],
  })
  console.log(`NCC PKNT · lệnh 01/26-27 - BLACKIN · NK-0204 352 Bộ × 165.000 · vật liệu "Sắt mạ kẽm" · hẹn 20/10/2026 · người lập ${nga.name}`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const po = await posService.create(nga, input)
  const { error } = await db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id) // prettier-ignore
  if (error) throw new Error(`số ĐH: ${error.message}`)
  console.log(`✓ ${po.code} (nháp) — hẹn giao ${po.expected_at}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
