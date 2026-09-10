import type { ShipmentInput } from '@/lib/po-shipments'

/**
 * LOGIC THUẦN CỦA PHẦN GIAO & NHẬN HÀNG trên màn chứng từ đơn mua — không React,
 * có test. Ba câu hỏi của người mua sau khi gửi đơn: NCC hẹn giao khi nào, hàng
 * về được bao nhiêu, còn thiếu thì làm gì. UI ở `NhanHangPanel.tsx` chỉ bày.
 *
 * KHÔNG MỞ ĐƯỜNG GHI MỚI: mọi route ở đây là route bản cũ `/planning/pos/[id]`
 * đang gọi (`usePoActions.ts`); màn mới chỉ đổi cách bày.
 */

export type ShipmentLite = {
  id: string
  seq: number
  expected_date: string
  status: string
  note: string | null
  lines: { po_line_id: string; qty: number }[]
}

export type ShipmentLineRef = {
  id: string
  name: string
  unit: string
  qty_ordered: number
  /** Thành tiền cả dòng — null khi chưa có giá. */
  amount: number | null
  /** Giá theo đơn vị 2 (đ/kg…) — tiền đợt là ước theo tỷ lệ. */
  price_approx: boolean
}

/** Nhãn + tone vòng đời của một đợt. `overdue` = còn sống mà đã qua ngày hẹn. */
export function shipmentBadge(
  status: string,
  overdue: boolean,
): { label: string; tone: 'neutral' | 'warn' | 'done' | 'stop' } {
  if (status === 'cancelled') return { label: 'Đã huỷ', tone: 'neutral' }
  if (status === 'received') return { label: 'Đã nhận', tone: 'done' }
  if (overdue) return { label: 'Quá hẹn', tone: 'stop' }
  if (status === 'arrived') return { label: 'Xe tới', tone: 'warn' }
  return { label: 'Đang hẹn', tone: 'neutral' }
}

/**
 * KẾT LUẬN của một dòng trong ma trận nhận: Đủ / Thiếu / Chưa về / Dư / Chốt thiếu.
 * `kind` ánh xạ thẳng sang `LineStatus` của kit.
 */
export function receiptVerdict(
  qtyOrdered: number,
  st:
    | { qty_received: number; qty_missing: number; closed_short_at: string | null }
    | undefined,
): {
  label: string
  kind: 'idle' | 'part' | 'done' | 'short'
  received: number
  missing: number
} {
  const received = st?.qty_received ?? 0
  const missing = st?.qty_missing ?? qtyOrdered - received
  if (st?.closed_short_at) return { label: `Chốt thiếu ${fmt(missing)}`, kind: 'short', received, missing } // prettier-ignore
  if (missing > 0.000001) {
    return received > 0
      ? { label: `Thiếu ${fmt(missing)}`, kind: 'part', received, missing }
      : { label: 'Chưa về', kind: 'idle', received, missing }
  }
  if (missing < -0.000001) return { label: `Dư ${fmt(-missing)}`, kind: 'done', received, missing } // prettier-ignore
  return { label: 'Đủ', kind: 'done', received, missing }
}

/**
 * Từng vật tư đã HẸN bao nhiêu / đặt bao nhiêu — trả lời "còn bao nhiêu chưa có
 * đợt" mà không phải cộng nhẩm. Đợt đã huỷ không tính.
 */
export function scheduleRows(
  lines: { id: string; name: string; unit: string; qty_ordered: number }[],
  shipments: { status: string; lines: { po_line_id: string; qty: number }[] }[],
): {
  id: string
  name: string
  unit: string
  qty_ordered: number
  done: number
  left: number
}[] {
  const scheduled = new Map<string, number>()
  for (const s of shipments) {
    if (s.status === 'cancelled') continue
    for (const l of s.lines) scheduled.set(l.po_line_id, (scheduled.get(l.po_line_id) ?? 0) + l.qty) // prettier-ignore
  }
  return lines.map((l) => {
    const done = scheduled.get(l.id) ?? 0
    return { ...l, done, left: Math.max(l.qty_ordered - done, 0) }
  })
}

export type Batch = { date: string; qty: number | '' }

/**
 * Bảng khai "từng dòng, từng mảnh" của hộp NCC xác nhận → danh sách đợt gửi
 * server. Các mảnh CÙNG NGÀY gộp thành một đợt (đó là cách NCC giao: một chuyến
 * mang nhiều mã), mảnh SL ≤ 0 bỏ. Sắp theo ngày để đợt 1 là đợt sớm nhất.
 */
export function batchesToShipments(
  lineIds: string[],
  batches: Record<string, Batch[]>,
): ShipmentInput[] {
  const byDate = new Map<string, { po_line_id: string; qty: number }[]>()
  for (const id of lineIds) {
    for (const b of batches[id] ?? []) {
      const qty = typeof b.qty === 'number' ? b.qty : 0
      if (qty <= 0) continue
      const list = byDate.get(b.date) ?? []
      list.push({ po_line_id: id, qty })
      byDate.set(b.date, list)
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, lines]) => ({ expected_date: date, lines }))
}

/** Đơn chưa có đợt nào thì nói bước kế tiếp — theo đúng trạng thái đơn. */
export function shipmentEmptyHint(status: string, hasStockLines: boolean): string {
  switch (status) {
    case 'draft':
      return 'Chia đợt trong lúc sửa đơn; lịch đó in lên phiếu gửi nhà cung cấp.'
    case 'pending_approval':
      return 'Đơn đang chờ duyệt nên khoá sửa — rút về nháp rồi chia đợt.'
    case 'approved':
      return 'Lịch giao sẽ ghi ở bước "NCC xác nhận" sau khi gửi đơn.'
    case 'ordered':
      return 'Bấm "NCC xác nhận" ở tab Nhận hàng để ghi lịch NCC hẹn — mỗi dòng tách được nhiều đợt.'
    default:
      return hasStockLines
        ? 'Chưa ghi đợt nào — hiểu là giao một lần vào hạn giao của đơn.'
        : 'Đơn toàn dòng tự gõ (không gắn vật tư kho) nên không chia đợt.'
  }
}

/**
 * NÚT CỦA TAB NHẬN HÀNG — bày đủ, khoá kèm lý do (Dynamics Action Pane).
 * Mỗi cờ là một cặp [được không, vì sao không].
 */
export function receiveActions(i: {
  status: string
  canEdit: boolean
  hasStockLines: boolean
  openStockLines: number
}): Record<
  'confirm' | 'addShipment' | 'transit' | 'receive' | 'closeShort' | 'acceptByHand',
  { ok: boolean; why?: string }
> {
  const sent = ['ordered', 'confirmed', 'in_transit', 'partial'].includes(i.status)
  const notOwn = i.canEdit ? undefined : 'Chỉ người phụ trách đơn mới làm được'
  const gate = (ok: boolean, why: string) =>
    notOwn ? { ok: false, why: notOwn } : ok ? { ok: true } : { ok: false, why }
  return {
    confirm: gate(i.status === 'ordered', i.status === 'confirmed' || i.status === 'in_transit' || i.status === 'partial' ? 'NCC đã xác nhận rồi — thêm đợt nếu NCC hẹn giao bù' : 'Chỉ ghi được sau khi đã gửi đơn cho NCC'), // prettier-ignore
    addShipment: gate(['confirmed', 'in_transit', 'partial'].includes(i.status) && i.hasStockLines, !i.hasStockLines ? 'Đơn không có dòng vật tư kho để chia đợt' : 'Chỉ thêm đợt sau khi NCC đã xác nhận'), // prettier-ignore
    transit: gate(i.status === 'confirmed', 'Chỉ dùng khi đơn ở bước "NCC xác nhận"'),
    receive: { ok: sent, why: sent ? undefined : 'Chỉ nhận hàng được sau khi đơn đã gửi nhà cung cấp' }, // prettier-ignore
    closeShort: gate(sent && i.openStockLines > 0, i.openStockLines === 0 ? 'Không còn dòng nào đang chờ về' : 'Chỉ chốt thiếu trên đơn đã gửi NCC'), // prettier-ignore
    acceptByHand: gate(sent && !i.hasStockLines, i.hasStockLines ? 'Đơn có dòng vật tư kho — nhận qua phiếu nhập bên Kho' : 'Chỉ dùng cho đơn đã gửi NCC'), // prettier-ignore
  }
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
