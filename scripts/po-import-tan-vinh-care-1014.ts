/**
 * ĐƠN IN CARE INSTRUCTION — TÂN VINH — LSX 02.2026 ROSCO IBIZA (14/10/2026) cho anh Việt.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-tan-vinh-care-1014.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-tan-vinh-care-1014.ts --apply   # ghi
 *
 * Tờ (PDF chụp iPhone, 2 trang: đơn + mẫu in): Số ĐH 02-2026 HG/TV · ngày 02/10/2026 ·
 * 1 dòng CARE INSTRUCTION 1.350 tờ × 1.100 = 1.485.000 + VAT 8% 118.800 = 1.603.800.
 * Tờ ghi "Đơn giá trên đã bao gồm VAT 8%" nhưng khối tổng cộng VAT lên — mâu thuẫn y như
 * tờ 01-2026 HG/TV (PO-2026-0158) → làm như đơn đó: price_includes_vat = false.
 * Người lập Nguyễn Võ Nam Việt, KT. GĐ Phó GĐ Vũ Phương Thảo ký + đóng dấu trên giấy.
 *
 * User 14/10/2026: "đã đến giai đoạn chờ hàng, skip qua duyệt" ⇒ ghi hộ như PO-2026-0136:
 * Việt soạn, Thảo duyệt trên giấy 02/10 (08:00 quy ước), NCC nhận đơn cùng ngày →
 * `confirmed` ("Chờ giao"); ordered_at = confirmed_at. Hẹn giao = mốc cuối "5–7 ngày kể từ
 * ngày gởi đơn, không tính chủ nhật" = 10/10/2026.
 * Mẫu `simple` không nhận dòng tự do → cấp 1 mã vật tư như 6 mã HDLR BB-0055…0060.
 */
import { readFileSync } from 'node:fs'
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'
import { materialCreateSchema } from '@/modules/dept/warehouse/warehouse.schema'
import { filesService } from '@/modules/core/files/files.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { poTrackingRepo } from '@/modules/dept/supply/po-tracking.repo'

const APPLY = process.argv.includes('--apply')
const PDF =
  process.env.PDF ??
  'C:/Users/HP/Downloads/ĐƠN ĐẶT HÀNG IN CARE INSTRUCTION - In Tân Vinh 02.pdf'
const SO_DH = '02-2026 HG/TV'
const NGAY = '2026-10-02'
const HEN_GIAO = '2026-10-10'
const LSX = '02/26-27 - ROSCO'
const NCC = 'af1dcd75-b206-479c-87d5-1dddc21501f6' // TV — CÔNG TY TNHH TM DV TH TÂN VINH
const VIET = 'viet@hoanggia.de'
const THAO = 'ketoan2@hoanggia.de'
const QUY_CACH = 'A4 For 70, 1 mặt đen trắng, 1 tờ A4 cắt 4 miếng, giao thành phẩm'
const VT = {
  name: 'Care Instruction mặt bàn - Rosco Ibiza (in A4 For 70, 1 mặt đen trắng, cắt 4)',
  unit: 'Tờ',
  spec: QUY_CACH,
  group_name: 'Bao bì - đóng gói - tem nhãn',
  sub_group: 'Tem - nhãn - thẻ - decal',
  default_supplier_id: NCC,
  last_purchase_price: 1_100,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- kết quả PostgREST thô của script một lần
async function one<T = any>(
  p: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  what: string,
): Promise<T> {
  const { data, error } = await p
  if (error || data == null) throw new Error(`${what}: ${error?.message ?? 'không thấy'}`)
  return data as T
}

async function main() {
  const hang = 1_350 * 1_100
  const vat = Math.round(hang * 0.08)
  if (hang !== 1_485_000 || vat !== 118_800 || hang + vat !== 1_603_800)
    throw new Error(`lệch tờ: ${hang} / ${vat}`)
  console.log(`Tiền hàng ${hang.toLocaleString('vi-VN')} + VAT 8% ${vat.toLocaleString('vi-VN')} = ${(hang + vat).toLocaleString('vi-VN')} — khớp tờ`) // prettier-ignore

  const { data: da } = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', SO_DH) // prettier-ignore
  if (da?.length)
    return console.log(`ĐÃ NẠP: ${da.map((x) => x.code).join(', ')} — dừng.`)

  const lsx = await one(db().from('production_orders').select('id').eq('code', LSX).single(), 'lệnh') // prettier-ignore
  const users = await usersRepo.list()
  const viet = users.find((u) => u.email === VIET)
  const thao = users.find((u) => u.email === THAO)
  if (!viet || !thao) throw new Error('thiếu người dùng Việt / Thảo')
  const pdf = readFileSync(PDF)
  const { data: vtCo } = await db().from('warehouse_materials').select('id, code').eq('name', VT.name).maybeSingle() // prettier-ignore
  console.log(`Lệnh ${LSX} · NCC Tân Vinh · người lập ${viet.name} · duyệt (giấy) ${thao.name} · vật tư ${vtCo ? `có sẵn ${vtCo.code}` : 'MỚI'} · PDF ${(pdf.byteLength / 1024).toFixed(0)} KB`) // prettier-ignore
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  const vt = vtCo ?? (await materialsService.create(viet, materialCreateSchema.parse(VT)))
  if (!vtCo) console.log(`+ vật tư ${vt.code}`)

  const po = await posService.create(
    viet,
    poCreateSchema.parse({
      production_order_id: lsx.id,
      supplier_id: NCC,
      template: 'simple',
      currency: 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      expected_at: HEN_GIAO,
      terms_quality: 'Đúng định lượng, đúng quy cách, in rõ đúng nội dung.',
      terms_delivery_place: 'CÔNG TY TNHH SX-TM HOÀNG GIA - Lô C3, Cụm CN Cát Nhơn, Xã Xuân An, Gia Lai', // prettier-ignore
      terms_payment: 'Công nợ cuối tháng. Tên TK: Công ty TNHH Thương mại dịch vụ Tổng hợp Tân Vinh — STK 0051000557764, Vietcombank', // prettier-ignore
      terms_invoice: 'Hóa đơn GTGT',
      terms_lead_time: 'Giao hàng từ 5 đến 7 ngày kể từ ngày gởi đơn hàng (không tính ngày lễ & chủ nhật).', // prettier-ignore
      signer_role: 'NGƯỜI LẬP',
      note: `Đơn giấy số ${SO_DH} ngày 02/10/2026 — in Care Instruction (hướng dẫn bảo quản mặt bàn) cho LSX 02.2026 ROSCO IBIZA. File đơn đã ký đính kèm.`, // prettier-ignore
      lines: [
        {
          material_id: vt.id,
          line_name: 'CARE INSTRUCTION',
          line_unit: 'Tờ',
          qty_ordered: 1_350,
          unit_price: 1_100,
          note: `In giấy ${QUY_CACH}`,
        },
      ],
    }),
  )
  await one(db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id).select('id').single(), 'số ĐH') // prettier-ignore
  console.log(`+ ${po.code} (nháp)`)

  // Ghi hộ duyệt giấy + NCC nhận đơn → Chờ giao.
  const at = (hm: string) => `${NGAY}T${hm}:00+07:00`
  const { error: ee } = await db()
    .from('approval_events')
    .insert([
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'submitted', actor_id: viet.id, created_at: at('07:55'), reason: 'Ghi hộ 14/10/2026 — đơn đã trình ký trên giấy.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'approved', actor_id: thao.id, created_at: at('08:00'), reason: 'KT. GĐ ký duyệt + đóng dấu TRÊN GIẤY ngày 02/10/2026 — ghi hộ lên hệ thống ngày 14/10/2026 theo chỉ đạo; giấy không ghi giờ (08:00 là giờ quy ước).' }, // prettier-ignore
    ])
  if (ee) throw new Error(`nhật ký duyệt: ${ee.message}`)
  const confirmNote =
    'NCC nhận đơn, giao 5–7 ngày — ghi hộ 14/10/2026 (đơn đã ở bước chờ hàng về).'
  await poTrackingRepo.logCommits([
    { po_id: po.id, kind: 'ncc_xac_nhan', date_after: HEN_GIAO, reason: confirmNote, created_by: viet.id }, // prettier-ignore
  ])
  await one(
    db()
      .from('supply_purchase_orders')
      .update({
        status: 'confirmed',
        approved_by: thao.id,
        approved_at: at('08:00'),
        ordered_at: at('08:05'),
        confirmed_at: at('08:05'),
        confirmed_note: confirmNote,
        expected_at: HEN_GIAO,
      })
      .eq('id', po.id)
      .eq('status', 'draft')
      .select('id')
      .single(),
    'chuyển Chờ giao',
  )
  console.log(`✓ ${po.code} → Chờ giao (ghi hộ ${thao.name} duyệt 02/10/2026, hẹn giao 10/10/2026)`) // prettier-ignore

  // Đính file SAU CÙNG, nuốt lỗi: hỏng khâu này không được làm đơn trông như tạo hỏng.
  try {
    await filesService.uploadFromServer(viet, {
      buffer: pdf,
      filename: 'ĐƠN ĐẶT HÀNG IN CARE INSTRUCTION - In Tân Vinh 02.pdf',
      mime_type: 'application/pdf',
      bucket: 'attachments',
      parent: { kind: 'purchase_order', id: po.id },
      doc_type: 'other',
    })
    console.log('+ đính PDF đơn đã ký')
  } catch (e) {
    console.error('! đính PDF lỗi (đơn vẫn đã tạo):', e)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
