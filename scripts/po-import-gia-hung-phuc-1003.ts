/**
 * ĐƠN NHỰA GIA HƯNG PHÚC — LSX 2 ROSCO CHELSEA (ảnh tờ đơn, 03/10/2026) cho chị Nga.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-gia-hung-phuc-1003.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-import-gia-hung-phuc-1003.ts --apply   # ghi
 *
 * Tờ: Số ĐH 1/2026- HG/HP · Theo HĐ số 1-2026 · ngày 09/09/2026 · VAT 8% · 3 dòng
 * (Nắp tăng đơ phi 25 tán M8 · Chân đế phi 25 (M8x20) · Chân đế phi 37.5mm) ·
 * 3 đợt giao 07/10/2026 · 25/10/2026 · "2/1/2026" (user chốt 03/10: = 02/01/2027).
 * Tiền hàng 83.615.000 + VAT 6.689.200 = 90.304.200 — khớp tờ từng đồng.
 *
 * Quyết định của user 03/10/2026:
 *  · NCC MỚI "Gia Hưng Phúc" (mã HP) — KHÔNG gộp vào GHP "Gia Huy Phát" dù cùng địa
 *    chỉ 10/21 Ấp 4 Đông Thạnh; needs soát (MST trống trên tờ).
 *  · "Đang chờ nhận hàng" ⇒ ghi hộ duyệt giấy như 5 đơn ROSCO 2 (25/09): Nga soạn,
 *    Vũ Phương Thảo duyệt + gửi NCC ngày 09/09/2026 (giờ quy ước 08:00/08:05).
 *
 * Đơn tạo qua `posService.create` (deriveLine, đánh số, lịch đợt) — không ghi thẳng
 * bảng dòng. Chống nạp đôi theo số ĐH trên tờ.
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { poCreateSchema } from '@/modules/dept/supply/pos.schema'

const APPLY = process.argv.includes('--apply')
const SO_DH = '1/2026- HG/HP'
const NGAY = '2026-09-09'
const LSX = '02/26-27 - ROSCO'
const NGA = 'kehoach1@hoanggia.de'
const THAO = 'ketoan2@hoanggia.de'
const NCC = {
  code: 'HP',
  name: 'CÔNG TY TNHH SX TM DV CƠ KHÍ GIA HƯNG PHÚC',
  address: 'Số 10/21E Ấp 4, Xã Đông Thạnh, Tp. HCM, Việt Nam',
  contact_name: 'Chị Vy',
  contact_phone: '0932.142.231',
  note: 'Khai từ tờ đơn 1/2026- HG/HP (03/10/2026). Tờ trống MST — bổ sung. CÙNG ĐỊA CHỈ với GHP "Gia Huy Phát" (10/21 Ấp 4 Đông Thạnh) — user chốt để hai NCC riêng.',
}
const GRADE = 'Nhựa màu đen (như mẫu gởi)'
const LINES = [
  {
    mat: 'PKN0390',
    spec: 'M8',
    qty: 35_860,
    price: 800,
    sp: 8_960,
    note: '8960 ghế xoay',
  },
  {
    mat: 'PKN0391',
    spec: '8x20',
    qty: 35_860,
    price: 900,
    sp: 8_960,
    note: '8960 ghế xoay',
  },
  { mat: 'PKN0392', spec: null, qty: 16_780, price: 1_350, sp: 4_190, note: '1/ 2240 bàn chữ nhật 2/ 1950 bàn tròn' }, // prettier-ignore
]
const DOT = [
  { date: '2026-10-07', qty: [9_880, 9_880, 4_480] },
  { date: '2026-10-25', qty: [15_232, 15_232, 8_680] },
  { date: '2027-01-02', qty: [10_748, 10_748, 3_620], note: 'Tờ ghi "2/1/2026" — hiểu là 02/01/2027 (user chốt 03/10/2026).' }, // prettier-ignore
]
const fmt = (n: number) => n.toLocaleString('vi-VN')

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- kết quả PostgREST thô của script một lần
async function one<T = any>(
  p: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  what: string,
): Promise<T> {
  // prettier-ignore
  const { data, error } = await p
  if (error || data == null) throw new Error(`${what}: ${error?.message ?? 'không thấy'}`)
  return data as T
}

async function main() {
  // Kiểm tờ: đợt cộng đúng SL đặt từng dòng, tiền khớp tờ.
  LINES.forEach((l, i) => {
    const tong = DOT.reduce((s, d) => s + d.qty[i], 0)
    if (tong !== l.qty)
      throw new Error(`Dòng ${i + 1}: đợt cộng ${tong} ≠ SL đặt ${l.qty}`)
  })
  const tien = LINES.reduce((s, l) => s + l.qty * l.price, 0)
  if (tien !== 83_615_000) throw new Error(`Tiền hàng ${tien} ≠ tờ 83.615.000`)
  console.log(`Tiền hàng ${fmt(tien)} + VAT 8% ${fmt(tien * 0.08)} = ${fmt(tien * 1.08)}`)

  const { data: da } = await db().from('supply_purchase_orders').select('code').eq('supplier_doc_no', SO_DH) // prettier-ignore
  if (da?.length)
    return console.log(`ĐÃ NẠP: ${da.map((x) => x.code).join(', ')} — dừng.`)

  const lsx = await one(
    db().from('production_orders').select('id').eq('code', LSX).single(),
    'lệnh',
  )
  const mats = await one(db().from('warehouse_materials').select('id, code').in('code', LINES.map((l) => l.mat)), 'vật tư') // prettier-ignore
  const matId = (c: string) => (mats as { id: string; code: string }[]).find((m) => m.code === c)?.id ?? (() => { throw new Error(`thiếu ${c}`) })() // prettier-ignore
  const nga = (await usersRepo.list()).find((u) => u.email === NGA)
  const thao = (await usersRepo.list()).find((u) => u.email === THAO)
  if (!nga || !thao) throw new Error('thiếu người dùng Nga / Thảo')
  let sup: { id: string; code: string | null; name: string } | null = (await db().from('supply_suppliers').select('id, code, name').eq('code', NCC.code).maybeSingle()).data // prettier-ignore
  if (sup && sup.name !== NCC.name)
    throw new Error(`Mã ${NCC.code} đã là NCC khác: ${sup.name}`)
  console.log(`NCC ${sup ? `có sẵn ${sup.code}` : `MỚI ${NCC.code} ${NCC.name}`} · lệnh ${LSX} · người lập ${nga.name} · duyệt ${thao.name}`) // prettier-ignore
  LINES.forEach((l) =>
    console.log(`  ${l.mat} ${fmt(l.qty)} × ${fmt(l.price)} = ${fmt(l.qty * l.price)}`),
  )
  DOT.forEach((d) => console.log(`  đợt ${d.date}: ${d.qty.map(fmt).join(' · ')}`))
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
      template: 'accessory',
      currency: 'VND',
      vat_rate: 8,
      price_includes_vat: false,
      contract_no: '1-2026',
      note: `Nạp từ ảnh tờ đơn ngày 03/10/2026. Ngày trên đơn: 09/09/2026. Ghi trên đơn: LSX 2 - ROSCO CHELSEA (SL khớp lệnh ${LSX}). Đợt 3 tờ ghi "2/1/2026" — hiểu là 02/01/2027.`, // prettier-ignore
      shipments: DOT.map((d) => ({
        expected_date: d.date,
        note: d.note ?? null,
        lines: d.qty.map((qty, line_index) => ({ line_index, qty })),
      })),
      lines: LINES.map((l) => ({
        material_id: matId(l.mat),
        qty_ordered: l.qty,
        unit_price: l.price,
        spec: l.spec,
        material_grade: GRADE,
        qty_demand: l.sp,
        dm_per_sp: 4,
        note: l.note,
      })),
    }),
  )
  await one(db().from('supply_purchase_orders').update({ supplier_doc_no: SO_DH }).eq('id', po.id).select('id').single(), 'số ĐH') // prettier-ignore
  console.log(`+ ${po.code} (nháp) — hẹn giao ${po.expected_at}`)

  // Ghi hộ duyệt + gửi NCC trên giấy — y hệt scripts/po-ghi-ho-duyet-giay.mjs.
  const at = (hm: string) => `${NGAY}T${hm}:00+07:00`
  const { error: ee } = await db()
    .from('approval_events')
    .insert([
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'submitted', actor_id: nga.id, created_at: at('07:55'), reason: 'Ghi hộ 03/10/2026 — đơn đã trình ký trên giấy.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: po.code, action: 'approved', actor_id: thao.id, created_at: at('08:00'), reason: 'Ký duyệt TRÊN GIẤY ngày 09/09/2026 — ghi hộ lên hệ thống ngày 03/10/2026 theo chỉ đạo; giấy không ghi giờ (08:00 là giờ quy ước).' }, // prettier-ignore
    ])
  if (ee) throw new Error(`nhật ký duyệt: ${ee.message}`)
  const fresh = await one(db().from('supply_purchase_orders').select('note').eq('id', po.id).single(), 'đọc lại') // prettier-ignore
  await one(
    db()
      .from('supply_purchase_orders')
      .update({
        status: 'ordered',
        approved_by: thao.id,
        approved_at: at('08:00'),
        ordered_at: at('08:05'),
        note: `${fresh.note ?? ''} Đã ký duyệt (${thao.name}) và gửi NCC trên giấy ngày 09/09/2026 — trạng thái ghi hộ 03/10/2026.`.trim(), // prettier-ignore
      })
      .eq('id', po.id)
      .eq('status', 'draft')
      .select('id')
      .single(),
    'chuyển gửi NCC',
  )
  console.log(`✓ ${po.code} → Đã gửi NCC (ghi hộ ${thao.name} duyệt 09/09/2026)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
