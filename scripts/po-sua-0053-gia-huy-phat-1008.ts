/**
 * SỬA PO-2026-0053 THEO TỜ ĐƠN GIA HUY PHÁT (ảnh tờ 1/2026- HG/GHP, 08/10/2026) cho chị Nga.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-sua-0053-gia-huy-phat-1008.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-sua-0053-gia-huy-phat-1008.ts --apply   # ghi
 *
 * Tờ: Số ĐH 1/2026- HG/GHP · Theo HĐ số 1/2026 · ngày 29/08/2026 · LSX 2 - ROSCO IBEZA ·
 * 1 dòng Chân côn phi 40 → 25 dài 342/357mm (PKN0394), Sắt ống phi 42, 42x25x342/357 ·
 * SL đơn hàng 8.600 × đm 4 → SL đặt 34.412 cái × 13.000 = 447.356.000 · VAT 10% 44.735.600
 * → 492.091.600 · 5 đợt (15–28/09 10.228 · 03/10 3.732 · 03/11 12.084 · 03/12 5.588 ·
 * "03/01/2026" 2.780 — hiểu là 03/01/2027).
 *
 * PO-0053 (Nga tạo 03/09) đã có đúng số ĐH / NCC / điều khoản nhưng nhập SL đơn hàng 8.600 vào
 * ô SL đặt, VAT 8%, không lịch giao; nạp nền kho 11/09 (PNK-2026-0041) ghi nhận đủ 8.600 nên đơn
 * đang "Đã nhận đủ". User 08/10: "sửa PO-2026-0053 theo tờ, giữ 8.600 đã nhận".
 *
 * Đi đúng cửa của app, không ghi thẳng bảng dòng:
 *  1. Ghi hộ duyệt giấy + NCC xác nhận ngày 29/08 (như các đơn ROSCO 2 / An Khánh), trạng thái
 *     về `partial` — điều chỉnh chỉ mở cho đơn chưa về đủ (sau sửa: đã về 8.600 / 34.412).
 *  2. `posService.adjust` (deriveLine, kiểm ≥ đã nhận, sổ phát sinh) — nguyên nhân "Nhập sai".
 *  3. `posService.addShipments` — lịch 5 đợt đúng tờ.
 * KHÔNG tách đợt theo phiếu PNK-2026-0041: phần còn lại của đợt 1 phải hẹn ngày ≥ hôm nay mà tờ
 * không nói — hộp Giao nhận tự đề xuất tách cho chị Nga (cùng cách PO-2026-0084, 07/10).
 */
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { poAdjustSchema } from '@/modules/dept/supply/pos.schema'
import { poTrackingRepo } from '@/modules/dept/supply/po-tracking.repo'
import { poAdjustmentsRepo } from '@/modules/dept/supply/po-adjustments.repo'

const APPLY = process.argv.includes('--apply')
const CODE = 'PO-2026-0053'
const SO_DH = '1/2026- HG/GHP'
const NGAY = '2026-08-29'
const NGA = 'kehoach1@hoanggia.de'
const THAO = 'ketoan2@hoanggia.de'
const QTY = 34_412
const PRICE = 13_000
const DOT = [
  { date: '2026-09-28', qty: 10_228, note: 'Tờ ghi 15/9–28/9/2026 (lấy mốc cuối).' },
  { date: '2026-10-03', qty: 3_732 },
  { date: '2026-11-03', qty: 12_084 },
  { date: '2026-12-03', qty: 5_588 },
  { date: '2027-01-03', qty: 2_780, note: 'Tờ ghi "03/01/2026" — hiểu là 03/01/2027.' },
]
const fmt = (n: number) => n.toLocaleString('vi-VN')

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
  // Kiểm tờ: đợt cộng đúng SL đặt, tiền khớp tờ.
  const tongDot = DOT.reduce((s, d) => s + d.qty, 0)
  if (tongDot !== QTY) throw new Error(`Đợt cộng ${tongDot} ≠ SL đặt ${QTY}`)
  const tien = QTY * PRICE
  if (tien !== 447_356_000) throw new Error(`Tiền hàng ${tien} ≠ tờ 447.356.000`)
  if (Math.round(tien * 1.1) !== 492_091_600) throw new Error('Tổng thanh toán ≠ tờ')
  console.log(`Tờ: ${fmt(QTY)} × ${fmt(PRICE)} = ${fmt(tien)} + VAT 10% ${fmt(tien * 0.1)} = ${fmt(tien * 1.1)}`) // prettier-ignore

  const po = await one(db().from('supply_purchase_orders').select('id, code, status, supplier_doc_no, vat_rate, note').eq('code', CODE).single(), 'đơn') // prettier-ignore
  if (po.supplier_doc_no !== SO_DH) throw new Error(`${CODE} mang số ĐH ${po.supplier_doc_no} ≠ ${SO_DH}`) // prettier-ignore
  const lines = await one<Record<string, unknown>[]>(db().from('supply_purchase_order_lines').select('*').eq('po_id', po.id), 'dòng') // prettier-ignore
  if (lines.length !== 1) throw new Error(`đơn có ${lines.length} dòng, chờ 1`)
  const line = lines[0]
  const seq = await poAdjustmentsRepo.lastSeq(po.id)
  const ships = await one<unknown[]>(db().from('supply_po_shipments').select('id').eq('po_id', po.id), 'đợt') // prettier-ignore
  console.log(`${CODE}: ${po.status} · VAT ${po.vat_rate}% · SL đặt ${fmt(Number(line.qty_ordered))} · điều chỉnh đã có ${seq} lần · ${ships.length} đợt`) // prettier-ignore
  if (Number(line.qty_ordered) === QTY && ships.length)
    return console.log('ĐÃ SỬA — dừng.')
  if (po.status !== 'received' && po.status !== 'partial')
    throw new Error(`Đơn đang ${po.status} — chờ received/partial`)

  const users = await usersRepo.list()
  const nga = users.find((u) => u.email === NGA)
  const thao = users.find((u) => u.email === THAO)
  if (!nga || !thao) throw new Error('thiếu người dùng Nga / Thảo')
  DOT.forEach((d, i) => console.log(`  đợt ${i + 1} ${d.date}: ${fmt(d.qty)}`))
  if (!APPLY) return console.log('\nDò khô — thêm --apply để ghi.')

  // 1) Ghi hộ duyệt giấy + NCC xác nhận 29/08 → về "đang nhận" để điều chỉnh được.
  const at = (hm: string) => `${NGAY}T${hm}:00+07:00`
  const { error: ee } = await db()
    .from('approval_events')
    .insert([
      { entity_type: 'po', entity_id: po.id, entity_code: CODE, action: 'submitted', actor_id: nga.id, created_at: at('07:55'), reason: 'Ghi hộ 08/10/2026 — đơn đã trình ký trên giấy.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: CODE, action: 'approved', actor_id: thao.id, created_at: at('08:00'), reason: 'Ký duyệt TRÊN GIẤY ngày 29/08/2026 — ghi hộ lên hệ thống ngày 08/10/2026 theo chỉ đạo; giấy không ghi giờ (08:00 là giờ quy ước).' }, // prettier-ignore
    ])
  if (ee) throw new Error(`nhật ký duyệt: ${ee.message}`)
  const confirmNote = 'NCC nhận đơn, giao theo lịch 5 đợt trên tờ — ghi hộ 08/10/2026 (hàng đang lấy về hằng ngày).' // prettier-ignore
  await poTrackingRepo.logCommits([
    { po_id: po.id, kind: 'ncc_xac_nhan', date_after: DOT[0].date, reason: confirmNote, created_by: nga.id }, // prettier-ignore
  ])
  await one(
    db()
      .from('supply_purchase_orders')
      .update({
        status: 'partial',
        approved_by: thao.id,
        approved_at: at('08:00'),
        ordered_at: at('08:05'),
        confirmed_at: at('08:05'),
        confirmed_note: confirmNote,
        contract_no: '1/2026',
        note: `${po.note ? `${po.note} ` : ''}Sửa theo ảnh tờ đơn ngày 08/10/2026: ngày trên đơn 29/08/2026, ghi trên đơn LSX 2 - ROSCO IBEZA. Đã ký duyệt (${thao.name}) trên giấy — ghi hộ. Phiếu nạp nền PNK-2026-0041 (11/09) giữ nguyên 8.600 đã nhận.`, // prettier-ignore
      })
      .eq('id', po.id)
      .eq('status', po.status)
      .select('id')
      .single(),
    'ghi hộ duyệt',
  )
  console.log(`✓ ghi hộ ${thao.name} duyệt + NCC xác nhận 29/08 → đang nhận`)

  // 2) Điều chỉnh: SL đặt 34.412, SL đơn hàng 8.600 × đm 4, VAT 10%.
  const adj = await posService.adjust(
    nga,
    po.id,
    poAdjustSchema.parse({
      base_seq: seq,
      cause: 'nhap_sai',
      reason: `Đơn gốc nhập SL đơn hàng 8.600 vào ô SL đặt và VAT 8%. Tờ ${SO_DH} ngày 29/08/2026: SL đặt 34.412 cái (8.600 SP × đm 4, dư 12), VAT 10% — sửa theo tờ, ghi hộ 08/10/2026.`, // prettier-ignore
      vat_rate: 10,
      lines: [
        {
          id: line.id,
          material_id: line.material_id,
          qty_ordered: QTY,
          unit_price: PRICE,
          spec: line.spec,
          material_grade: line.material_grade,
          qty_demand: 8_600,
          dm_per_sp: 4,
          note: line.note,
        },
      ],
    }),
  )
  console.log(`✓ điều chỉnh lần ${adj.seq}: chênh tiền ${fmt(adj.delta_total)}`)

  // 3) Lịch 5 đợt đúng tờ.
  await posService.addShipments(
    nga,
    po.id,
    DOT.map((d) => ({
      expected_date: d.date,
      note: d.note ?? null,
      lines: [{ po_line_id: String(line.id), qty: d.qty }],
    })),
  )
  const after = await one(db().from('supply_purchase_orders').select('status, vat_rate, expected_at').eq('id', po.id).single(), 'đọc lại') // prettier-ignore
  console.log(`✓ ${CODE} → ${after.status} · VAT ${after.vat_rate}% · hẹn giao ${after.expected_at} · 5 đợt`) // prettier-ignore
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
