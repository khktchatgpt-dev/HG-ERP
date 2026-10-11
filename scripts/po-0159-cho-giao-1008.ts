/**
 * PO-2026-0159 (sơn Nam Việt) → "Chờ giao" theo bản ĐƠN ĐẶT HÀNG đã ký (08/10/2026) cho anh Nam Việt.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-0159-cho-giao-1008.ts           # dò khô
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/po-0159-cho-giao-1008.ts --apply   # ghi
 *
 * Bản quét "ĐƠN ĐẶT HÀNG - Sơn Nam Việt.pdf": phiếu in của chính PO-2026-0159 (LSX 02/26-27 - ROSCO,
 * 20 Kg Sơn 1 thành phần, VAT 8%, giao 10/10/2026), người lập Nguyễn Võ Nam Việt ký, GĐ Lê Hữu Điền
 * ký + đóng dấu ngày 08/10/2026. User: "sửa đơn này đến bước chờ giao nhận cho anh Việt".
 *  1. Ghi hộ duyệt giấy (như các đơn ROSCO 2 / An Khánh): Việt gửi duyệt, Điền Hg duyệt 08/10 —
 *     không phát thông báo "chờ duyệt" giả cho một đơn đã ký xong trên giấy.
 *  2. NCC xác nhận qua `posService.confirm` (hàng rào hẹn giao, ordered_at = confirmed_at, sổ hẹn,
 *     sự kiện po.ordered) — một đợt 10/10/2026 đủ 20 Kg.
 *  3. Đính bản PDF đã ký vào tab tài liệu của đơn (doc_type approval).
 * Đơn giá vẫn trống như trên tờ ký — bổ sung khi có giá.
 */
import fs from 'node:fs'
import { db } from '@/server/db'
import { posService } from '@/modules/dept/supply/pos.service'
import { usersRepo } from '@/modules/core/users/users.repo'
import { filesService } from '@/modules/core/files/files.service'

const APPLY = process.argv.includes('--apply')
const CODE = 'PO-2026-0159'
const FILE = 'C:/Users/HP/Downloads/ĐƠN ĐẶT HÀNG - Sơn Nam Việt.pdf'
const NGAY = '2026-10-08'
const HEN = '2026-10-10'

async function main() {
  const po = (await db().from('supply_purchase_orders').select('id, code, status, expected_at, production_order_id').eq('code', CODE).single()).data // prettier-ignore
  if (!po) throw new Error(`không thấy ${CODE}`)
  const lines = (await db().from('supply_purchase_order_lines').select('id, qty_ordered').eq('po_id', po.id)).data ?? [] // prettier-ignore
  const users = await usersRepo.list()
  const viet = users.find((u) => u.email === 'viet@hoanggia.de')
  const dien = users.find((u) => u.email === 'dien@hoanggia.de')
  if (!viet || !dien) throw new Error('thiếu anh Việt / anh Điền')
  console.log(`${CODE}: ${po.status} · hẹn ${po.expected_at} · ${lines.length} dòng · lệnh ${po.production_order_id ? 'có' : 'KHÔNG'}`) // prettier-ignore
  console.log(
    `File ký: ${fs.statSync(FILE).size.toLocaleString('vi-VN')} byte · duyệt: ${dien.name}`,
  )
  if (po.status === 'confirmed') return console.log('ĐÃ Ở CHỜ GIAO — dừng.')
  if (po.status !== 'draft') throw new Error(`Đơn đang ${po.status} — chờ nháp`)
  if (!APPLY) return console.log('Dò khô — thêm --apply để ghi.')

  // 1) Ghi hộ duyệt giấy.
  const at = (hm: string) => `${NGAY}T${hm}:00+07:00`
  const { error: ee } = await db()
    .from('approval_events')
    .insert([
      { entity_type: 'po', entity_id: po.id, entity_code: CODE, action: 'submitted', actor_id: viet.id, created_at: at('15:00'), reason: 'Ghi hộ 08/10/2026 — đơn đã trình ký trên giấy.' }, // prettier-ignore
      { entity_type: 'po', entity_id: po.id, entity_code: CODE, action: 'approved', actor_id: dien.id, created_at: at('15:05'), reason: 'Giám đốc Lê Hữu Điền ký + đóng dấu TRÊN GIẤY ngày 08/10/2026 — ghi hộ theo chỉ đạo; giấy không ghi giờ (giờ quy ước).' }, // prettier-ignore
    ])
  if (ee) throw new Error(`nhật ký duyệt: ${ee.message}`)
  const { error: ea } = await db()
    .from('supply_purchase_orders')
    .update({ status: 'approved', approved_by: dien.id, approved_at: at('15:05') })
    .eq('id', po.id)
    .eq('status', 'draft')
  if (ea) throw new Error(`ghi duyệt: ${ea.message}`)
  console.log(`✓ ghi hộ ${dien.name} duyệt 08/10`)

  // 2) NCC xác nhận → Chờ giao, đi đúng cửa của app.
  const after = await posService.confirm(viet, po.id, {
    confirmed_note: 'NCC nhận đơn đã ký 08/10/2026, giao ngày 10/10/2026 — ghi hộ.',
    shipments: [
      { expected_date: HEN, note: null, lines: lines.map((l) => ({ po_line_id: l.id, qty: Number(l.qty_ordered) })) }, // prettier-ignore
    ],
  })
  console.log(`✓ ${CODE} → ${after.status} · hẹn ${after.expected_at}`)

  // 3) Đính bản đã ký.
  const id = await filesService.uploadFromServer(viet, {
    buffer: fs.readFileSync(FILE),
    filename: 'ĐƠN ĐẶT HÀNG - Sơn Nam Việt.pdf',
    mime_type: 'application/pdf' as never,
    bucket: 'attachments',
    parent: { kind: 'purchase_order', id: po.id } as never,
    doc_type: 'approval',
  })
  console.log(`✓ đính bản ký → ${id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
