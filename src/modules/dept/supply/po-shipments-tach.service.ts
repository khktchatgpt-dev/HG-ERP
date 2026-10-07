import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, NotFound } from '@/server/http'
import { todayVn } from '@/lib/date-vn'
import { TACH_REASON_PREFIX } from '@/lib/po-tracking'
import {
  nextSeq,
  planSplitByReceipts,
  validateSplitRest,
  type ReceiptForSplit,
  type ShipmentInput,
  type SplitPlan,
} from '@/lib/po-shipments'
import { posRepo } from './pos.repo'
import { supplyRepo } from './supply.repo'
import { poShipmentsRepo, type PoShipment } from './po-shipments.repo'
import { poTrackingRepo } from './po-tracking.repo'
import { loadReceiptBatches, type ReceiptBatch } from './po-receipts.service'
import { syncPoExpectedAt } from './po-shipments.sync'
import { assertPoOwner } from './pos.service'

/**
 * TÁCH ĐỢT THEO PHIẾU NHẬP (07/10/2026 — artboard đã duyệt, PO-2026-0084).
 *
 * Đợt giao ôm 100% số đặt đã "xe tới", NCC giao lẻ nhiều chuyến, Kho nhập
 * phiếu không nối đợt → Sửa / Lấy trước bị chặn, Thêm đợt "vượt SL đặt". Tách
 * ở đây: mỗi phiếu nhập thành một đợt "Đã nhận", phần còn chờ thành đợt hẹn mới.
 *
 * CHỈ đổi kế hoạch giao + khoá nối phiếu→đợt. Số trong sổ kho, tồn, công nợ
 * không đổi một con số nào — phiếu là sự thật kế toán, đợt chỉ là kế hoạch.
 */

/** Trạng thái đơn còn sửa lịch giao được — cùng tập với `shipmentAction`. */
const OPEN_PO = ['approved', 'ordered', 'confirmed', 'in_transit', 'partial']

/**
 * Đợt ỨNG VIÊN + phương án tách của một đơn, hoặc `null` khi không có gì để tách.
 *
 * Ứng viên = đợt còn mở (planned/arrived) có `seq` NHỎ NHẤT — phiếu không nối
 * đợt nào thì hàng về thực tế trừ vào đợt sớm nhất. Chỉ đề xuất khi có ít nhất
 * một phiếu nhập CÒN HIỆU LỰC chưa nối đợt nào: luồng thường (Kho nhận theo
 * đợt) không bị làm phiền.
 */
export async function tachDotPlan(
  poId: string,
  /** Dữ liệu chỗ gọi đã nạp sẵn (hộp Giao nhận) — khỏi truy vấn lại. */
  pre: {
    shipments?: PoShipment[]
    batches?: ReceiptBatch[]
    docs?: Awaited<ReturnType<typeof supplyRepo.docsByPo>>
  } = {},
): Promise<{ shipment_id: string; plan: SplitPlan } | null> {
  const ships = pre.shipments ?? (await poShipmentsRepo.listByPo(poId))
  const target = ships
    .filter((s) => s.status === 'planned' || s.status === 'arrived')
    .sort((a, b) => a.seq - b.seq)[0]
  if (!target) return null

  const [batches, docs] = await Promise.all([
    pre.batches ?? loadReceiptBatches([poId]).then((r) => r[poId] ?? []),
    pre.docs ?? supplyRepo.docsByPo(poId),
  ])
  // Phiếu nhập còn hiệu lực: đúng loại 'receipt', chưa bị đảo. Phiếu đảo / trả /
  // điều chỉnh không thành đợt — chúng sửa số của phiếu khác, không phải chuyến xe.
  const live = new Map(
    docs.filter((d) => d.kind === 'receipt' && !d.reversed_by).map((d) => [d.doc_id, d]),
  )
  const cands = batches.filter((b) => b.doc_id && live.has(b.doc_id))
  if (cands.length === 0) return null
  const linkOf = await poShipmentsRepo.shipmentOfDocs(cands.map((b) => b.doc_id!))
  if (!cands.some((b) => !linkOf.has(b.doc_id!))) return null

  const receipts: ReceiptForSplit[] = cands
    .filter((b) => !linkOf.has(b.doc_id!) || linkOf.get(b.doc_id!) === target.id)
    .map((b) => ({
      doc_id: b.doc_id!,
      doc_code: b.doc_code ?? live.get(b.doc_id!)!.code,
      date: b.date,
      lines: Object.entries(b.by_line)
        .map(([po_line_id, v]) => ({ po_line_id, qty: v.qty }))
        .filter((l) => l.qty > 1e-4),
    }))
  const plan = planSplitByReceipts(target, receipts)
  return plan ? { shipment_id: target.id, plan } : null
}

export async function tachDotTheoPhieuNhap(
  user: User,
  shipmentId: string,
  input: { reason: string; rest: ShipmentInput[] },
): Promise<{ created: number }> {
  await assertAction(user, 'supply.po.manage')
  const shipment = await poShipmentsRepo.findById(shipmentId)
  if (!shipment) throw NotFound('Đợt giao không tồn tại')
  const po = await posRepo.findById(shipment.po_id)
  if (!po) throw NotFound('Đơn đặt không tồn tại')
  await assertPoOwner(user, po)
  if (!OPEN_PO.includes(po.status)) {
    throw BadRequest('Chỉ sửa đợt giao của đơn đã duyệt và chưa về đủ')
  }

  // Tính lại phương án ở server — không tin bản client gửi lên.
  const ships = await poShipmentsRepo.listByPo(po.id)
  const found = await tachDotPlan(po.id, { shipments: ships })
  if (!found || found.shipment_id !== shipmentId) {
    throw BadRequest('Đợt này không có phiếu nhập nào chưa nối đợt — không có gì để tách')
  }
  const { plan } = found
  const lines = await posRepo.listLines(po.id)
  const names = new Map(
    lines.map((l) => [l.id, l.material_name ?? l.line_name ?? 'Dòng']),
  )
  const errors = validateSplitRest(plan, input.rest, todayVn(), names)
  if (errors.length > 0) throw BadRequest(errors.join(' · '))

  const reason = input.reason.trim()
  const [first, ...later] = plan.receipts
  const rest = input.rest.map((s) => ({
    ...s,
    lines: s.lines.filter((l) => l.qty > 1e-4),
  }))
  const start = nextSeq(ships)
  const label = shipment.code ?? `đợt ${shipment.seq}`

  /*
    THỨ TỰ GHI: chèn đợt mới trước, nối phiếu, rồi mới co đợt gốc. Hỏng giữa
    chừng thì tệ nhất là thừa đợt (thấy được, huỷ được) — không bao giờ mất số
    của đợt gốc khi đợt thay nó chưa kịp có.
  */
  const ids = await poShipmentsRepo.insertMany(
    po.id,
    [
      ...later.map((r, i) => ({
        seq: start + i,
        expected_date: r.date,
        status: 'received' as const,
        note: `[${TACH_REASON_PREFIX} ${label}] ${r.doc_code} · ${reason}`,
        lines: r.lines,
      })),
      ...rest.map((s, i) => ({
        seq: start + later.length + i,
        expected_date: s.expected_date,
        note: `[${TACH_REASON_PREFIX} ${label}] phần còn chờ · ${reason}`,
        lines: s.lines,
      })),
    ],
    user.id,
  )
  for (const [i, r] of later.entries()) {
    await poShipmentsRepo.linkDoc(r.doc_id, ids.get(start + i)!)
  }
  await poShipmentsRepo.linkDoc(first.doc_id, shipment.id)
  await poShipmentsRepo.replaceLines(shipment.id, first.lines)
  await poShipmentsRepo.patch(shipment.id, {
    status: 'received',
    note: `[${TACH_REASON_PREFIX}] ${first.doc_code} · ${reason}${shipment.note ? ` · ${shipment.note}` : ''}`, // prettier-ignore
  })

  // Sổ cam kết: 'them_dot' + tiền tố (không thêm loại để khỏi đổi ràng buộc DB);
  // tiền tố loại các dòng này khỏi phép đo NCC trễ (`slipDays`).
  await poTrackingRepo.logCommits([
    ...later.map((r) => ({ po_id: po.id, kind: 'them_dot' as const, date_after: r.date, lines: r.lines, reason: `${TACH_REASON_PREFIX} ${label}: ${r.doc_code} · ${reason}`, created_by: user.id })), // prettier-ignore
    ...rest.map((s) => ({ po_id: po.id, kind: 'them_dot' as const, date_after: s.expected_date, lines: s.lines, reason: `${TACH_REASON_PREFIX} ${label}: phần còn chờ · ${reason}`, created_by: user.id })), // prettier-ignore
  ])
  await syncPoExpectedAt(po.id)
  return { created: later.length + rest.length }
}
