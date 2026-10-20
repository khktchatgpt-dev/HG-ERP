/**
 * ĐƠN GIA CÔNG NỆM / VẢI MÁI CHE RIVA — AN KHÁNH HƯNG MỸ — LSX 9 (HG-MX) (ảnh tờ đơn,
 * 06/10/2026) cho chị Nga.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-an-khanh-lsx09-1006.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-an-khanh-lsx09-1006.ts --apply   # ghi
 *
 * Tờ: Số ĐH 1/2026- HG/AK · ngày 17/09/2026 · USD · VAT 8% · chiết khấu 0% ·
 * tỷ giá Vietcombank 17/09/2026 = 25.800 · giao "Tháng 11/2026" · nhận hàng thanh toán.
 * 4 dòng = đúng 4 SP AC0008…AC0011 của lệnh 09/26-27 - MX (mã khách + SL khớp lệnh).
 * Tiền hàng 2.100 + VAT 168 = 2.268 USD — khớp tờ.
 *
 * Dòng là THÀNH PHẨM thuê may (gia công), không phải vật tư kho — theo luật
 * [don-gia-cong-thanh-pham]: dòng tự do (mẫu wood là mẫu duy nhất nhận dòng tự do),
 * `for_product_code` = mã khách như 39 dòng gia công cũ, KHÔNG cấp mã vật tư.
 * Màu vải ghi ở ô Quy cách ("Màu vải M45") — in ngay cạnh tên trên phiếu.
 *
 * User 06/10/2026: "đã đến phần chờ hàng về" ⇒ ghi hộ: Nga soạn, Vũ Phương Thảo
 * duyệt trên giấy 17/09 (08:00 quy ước), NCC xác nhận cùng ngày → `confirmed`
 * ("Chờ giao"); ordered_at = confirmed_at (luồng bỏ bước Gửi NCC 06/10).
 * Hẹn giao "Tháng 11/2026" → 30/11/2026 (mốc cuối khoảng, như các đơn trước).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'
import { poTrackingRepo } from '@/modules/dept/supply/po-tracking.repo'

const APPLY = process.argv.includes('--apply')
const SO_DH = '1/2026- HG/AK'
const NGAY = '2026-09-17'
const HEN_GIAO = '2026-11-30'
const FX = 25_800
const LSX = '09/26-27 - MX'
const NGA = 'kehoach1@hoanggia.de'
const THAO = 'ketoan2@hoanggia.de'
const NCC = {
  code: 'AK',
  name: 'CÔNG TY TNHH AN KHÁNH HƯNG MỸ',
  address: 'Hưng Mỹ 1, Xã Xuân An, Tỉnh Gia Lai',
  tax_no: '4101586772',
  contact_name: 'Chị Vi',
  contact_phone: '079.667.2712',
  type: 'Vải',
  note: 'Khai từ tờ đơn 1/2026- HG/AK (06/10/2026) — may nệm / vải mái che theo mẫu. KHÁC "Cty An Khánh Hưng Thịnh" (gia công đan mây).',
}
const GHI_CHU = 'May theo mẫu đã xác nhận'
const LINES = [
  { sp: '92800-262', name: 'Bộ vỏ nệm Riva xám (không vải mái che, tai)', unit: 'Bộ', qty: 40, price: 21, mau: 'M45' }, // prettier-ignore
  { sp: '92801-210', name: 'Bộ nệm Riva nâu (không vải mái che + tai)', unit: 'Bộ', qty: 20, price: 42, mau: 'M11' }, // prettier-ignore
  { sp: '92802-262', name: 'Vải mái che Riva xám (có tai)', unit: 'Cái', qty: 50, price: 7, mau: 'M45' }, // prettier-ignore
  { sp: '92803-228', name: 'Vải mái che Riva cobo (có tai)', unit: 'Cái', qty: 10, price: 7, mau: 'M21' }, // prettier-ignore
]

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
  const tien = LINES.reduce((s, l) => s + l.qty * l.price, 0)
  if (tien !== 2_100) throw new Error(`Tiền hàng ${tien} ≠ tờ 2.100`)
  console.log(`Tiền hàng ${tien} USD + VAT 8% ${tien * 0.08} = ${tien * 1.08} USD (≈ ${(tien * 1.08 * FX).toLocaleString('vi-VN')} đ @${FX})`) // prettier-ignore

  const { data: da } = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', SO_DH) // prettier-ignore
  if (da?.length)
    return console.log(`ĐÃ NẠP: ${da.map((x) => x.code).join(', ')} — dừng.`)

  const lsx = await one(db().from('production_orders').select('id').eq('code', LSX).single(), 'lệnh') // prettier-ignore
  // Đối chiếu tờ với lệnh: mã khách + SL phải khớp dòng lệnh.
  const pol = await one<{ customer_item_code: string | null; qty: number }[]>(
    db().from('production_order_lines').select('customer_item_code, qty').eq('production_order_id', lsx.id), // prettier-ignore
    'dòng lệnh',
  )
  for (const l of LINES) {
    const hit = pol.find((r) => r.customer_item_code === l.sp)
    if (!hit) throw new Error(`Lệnh ${LSX} không có SP ${l.sp}`)
    if (Number(hit.qty) !== l.qty)
      throw new Error(`${l.sp}: tờ ${l.qty} ≠ lệnh ${hit.qty}`)
  }
  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === NGA)
  const thao = users.find((u) => u.email === THAO)
  if (!nga || !thao) throw new Error('thiếu người dùng Nga / Thảo')
  let sup: { id: string; code: string | null; name: string } | null = (await db().from('supply_suppliers').select('id, code, name').eq('code', NCC.code).maybeSingle()).data // prettier-ignore
  if (sup && sup.name !== NCC.name)
    throw new Error(`Mã ${NCC.code} đã là NCC khác: ${sup.name}`)
  console.log(`NCC ${sup ? `có sẵn ${sup.code}` : `MỚI ${NCC.code} ${NCC.name}`} · lệnh ${LSX} (4/4 SP khớp) · người lập ${nga.name} · duyệt ${thao.name}`) // prettier-ignore
  LINES.forEach((l) => console.log(`  ${l.sp} ${l.name} · ${l.mau} · ${l.qty} ${l.unit} × $${l.price} = $${l.qty * l.price}`)) // prettier-ignore
  if (!APPLY) return console.log('\nDò khô — thêm --apply để ghi.')

  if (!sup) {
    sup = await one<{ id: string; code: string | null; name: string }>(
      db().from('supply_suppliers').insert({ ...NCC, status: 'active', is_active: true, can_order: true, created_by: nga.id, updated_by: nga.id }).select('id, code, name').single(), // prettier-ignore
      'khai NCC',
    )
    console.log(`+ NCC ${sup.code}`)
  }

  const po = await posService.create(
    nga,
    poCreateSchema.parse({
      production_order_id: lsx.id,
      supplier_id: sup.id,
      template: 'wood',
      currency: 'USD',
      vat_rate: 8,
      price_includes_vat: false,
      discount_amount: 0,
      expected_at: HEN_GIAO,
      terms_quality: 'Hàng đúng mẫu, đúng chuẩn loại theo yêu cầu trên đơn hàng.',
      terms_delivery_place: 'CÔNG TY TNHH SX & TM HOÀNG GIA',
      terms_payment: 'Nhận hàng thanh toán.',
      terms_invoice: 'Hóa đơn GTGT',
      terms_lead_time: 'Tháng 11/2026',
      signer_role: 'NGƯỜI MUA HÀNG',
      note: `Đơn gia công may nệm / vải mái che Riva (thành phẩm giao khách MERXX). Nạp từ ảnh tờ đơn ngày 06/10/2026. Ngày trên đơn: 17/09/2026. Ghi trên đơn: LSX 9 (HG-MX). Tỷ giá bình quân liên ngân hàng Vietcombank 17/09/2026: 25.800 đ. ${GHI_CHU}.`, // prettier-ignore
      lines: LINES.map((l) => ({
        material_id: null,
        line_name: l.name,
        line_unit: l.unit,
        qty_ordered: l.qty,
        unit_price: l.price,
        spec: `Màu vải ${l.mau}`,
        note: GHI_CHU,
      })),
    }),
  )
  // Mã khách trên dòng — như 39 dòng gia công cũ (schema tạo đơn không nhận cột này).
  const lines = await one<{ id: string; sort_order: number }[]>(
    db().from('supply_purchase_order_lines').select('id, sort_order').eq('po_id', po.id).order('sort_order'), // prettier-ignore
    'đọc dòng',
  )
  if (lines.length !== LINES.length) throw new Error(`đơn có ${lines.length} dòng ≠ ${LINES.length}`) // prettier-ignore
  for (const [i, row] of lines.entries()) {
    await one(db().from('supply_purchase_order_lines').update({ for_product_code: LINES[i].sp }).eq('id', row.id).select('id').single(), 'mã khách') // prettier-ignore
  }
  await one(db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id).select('id').single(), 'số ĐH') // prettier-ignore
  console.log(`+ ${po.code} (nháp)`)

  // Ghi hộ duyệt giấy + NCC xác nhận → Chờ giao.
  const at = (hm: string) => `${NGAY}T${hm}:00+07:00`
  const { error: ee } = await db()
    .from('approval_events')
    .insert([
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'submitted', actor_id: nga.id, created_at: at('07:55'), reason: 'Ghi hộ 06/10/2026 — đơn đã trình ký trên giấy.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'approved', actor_id: thao.id, created_at: at('08:00'), reason: 'Ký duyệt TRÊN GIẤY ngày 17/09/2026 — ghi hộ lên hệ thống ngày 06/10/2026 theo chỉ đạo; giấy không ghi giờ (08:00 là giờ quy ước).' }, // prettier-ignore
    ])
  if (ee) throw new Error(`nhật ký duyệt: ${ee.message}`)
  const confirmNote =
    'NCC nhận đơn, giao tháng 11/2026 — ghi hộ 06/10/2026 (đơn đã ở bước chờ hàng về).'
  await poTrackingRepo.logCommits([
    { po_id: po.id, kind: 'ncc_xac_nhan', date_after: HEN_GIAO, reason: confirmNote, created_by: nga.id }, // prettier-ignore
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
        fx_rate: FX,
        fx_date: NGAY,
        expected_at: HEN_GIAO,
      })
      .eq('id', po.id)
      .eq('status', 'draft')
      .select('id')
      .single(),
    'chuyển Chờ giao',
  )
  console.log(`✓ ${po.code} → Chờ giao (ghi hộ ${thao.name} duyệt 17/09/2026, hẹn giao 30/11/2026, tỷ giá ${FX})`) // prettier-ignore
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
