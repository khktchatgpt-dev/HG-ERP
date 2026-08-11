/**
 * Sẵn sàng vật tư cho 1 LSX — logic THUẦN, dùng cho panel "Cung ứng / Vật tư" ở
 * chi tiết LSX (shell Ban Giám đốc / Kế hoạch). Trả một MỨC tổng hợp trả lời
 * thẳng "vật tư đã đủ để chạy sản xuất chưa" + số liệu phụ (đã về / quá hẹn /
 * hẹn về gần nhất). Caller truyền todayIso (yyyy-mm-dd) để pure & testable.
 *
 * Nguồn trạng thái PO đồng bộ từ sổ kho (BR-08: partial/received), nên chỉ dựa
 * vào `status` là đủ cho mức tổng hợp — không cần đối soát từng dòng vật tư ở đây.
 */

import type { PoStatus as CanonPoStatus } from './po-status'

/**
 * Tệp này từng chép lại bảng nhãn/tone PO kèm lời tự dặn "GIỮ ĐỒNG BỘ với
 * PosManager" — hai bản chép đó không ai dùng mà vẫn kịp lệch nhau. Nhãn và màu
 * nay ở `@/lib/po-status`; ở đây chỉ còn phép ĐÁNH GIÁ mức sẵn sàng.
 */
export type PoStatus = Exclude<CanonPoStatus, 'draft'>

export type SupplyPo = { status: PoStatus; expected_at: string | null }

export type ReadinessLevel =
  /** Mọi PO đã về đủ — vật tư sẵn sàng chạy SX. */
  | 'ready'
  /** Đã đặt, đang trên đường/nhận một phần. */
  | 'inflight'
  /** Còn PO đang chờ GĐ duyệt — chưa gửi NCC được. */
  | 'pending'
  /** Có định mức (BOM) nhưng CHƯA có PO nào — cần đặt vật tư. */
  | 'none'
  /** Không có PO và cũng chưa có định mức — chưa tới bước mua. */
  | 'na'

export type SupplyReadiness = {
  level: ReadinessLevel
  label: string
  tone: 'green' | 'sky' | 'amber' | 'zinc'
  /** PO chưa huỷ. */
  activeCount: number
  /** PO đã về đủ. */
  receivedCount: number
  /** PO quá hẹn giao mà chưa về đủ. */
  overdueCount: number
  /** Hẹn về gần nhất trong các PO chưa về đủ (yyyy-mm-dd) — null nếu không có. */
  nextExpected: string | null
}

export function assessSupplyReadiness(
  pos: SupplyPo[],
  hasBom: boolean,
  todayIso: string,
): SupplyReadiness {
  const active = pos.filter((p) => p.status !== 'cancelled')
  const received = active.filter((p) => p.status === 'received')
  const notDone = active.filter((p) => p.status !== 'received')

  const overdueCount = notDone.filter(
    (p) => p.expected_at != null && p.expected_at < todayIso,
  ).length
  const nextExpected =
    notDone
      .map((p) => p.expected_at)
      .filter((d): d is string => d != null)
      .sort()[0] ?? null

  const base = {
    activeCount: active.length,
    receivedCount: received.length,
    overdueCount,
    nextExpected,
  }

  if (active.length === 0) {
    return hasBom
      ? { level: 'none', label: 'Chưa đặt vật tư', tone: 'amber', ...base }
      : { level: 'na', label: 'Chưa có đơn đặt vật tư', tone: 'zinc', ...base }
  }
  // Chờ duyệt là nút thắt hành động (cần GĐ gật) → ưu tiên nêu trước "đang về".
  if (active.some((p) => p.status === 'pending_approval')) {
    return { level: 'pending', label: 'Có PO chờ duyệt', tone: 'amber', ...base }
  }
  if (received.length === active.length) {
    return { level: 'ready', label: 'Vật tư đã về đủ', tone: 'green', ...base }
  }
  return { level: 'inflight', label: 'Đang đặt / về hàng', tone: 'sky', ...base }
}
