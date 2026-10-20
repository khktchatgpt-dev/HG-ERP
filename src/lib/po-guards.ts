/**
 * HÀNG RÀO ĐƠN MUA — các luật CHẶN thuần, có test (P1, 27/09/2026).
 *
 * Đối chiếu 18 tình huống thực tế của NV cung ứng lộ ra hai hàng rào chỉ nằm
 * trên giấy:
 *   · NCC "khoá đặt hàng" (`can_order = false`) — cột có, thẻ "Khoá đặt" có,
 *     nhưng không tầng nào kiểm: vẫn chọn được, vẫn tạo / gửi được đơn.
 *   · Huỷ đơn đã có hàng về kho — service chỉ chặn `received` / `cancelled`, nên
 *     đơn `partial` (đã nhập một phần) vẫn huỷ được, bỏ lại phiếu nhập treo trên
 *     một đơn "đã huỷ" và công nợ của phần đã nhận mất chỗ bám.
 *
 * Service và nút bấm dùng CHUNG các hàm này — câu lý do ở nút và lỗi server là
 * một câu.
 */

export type SupplierGate = {
  is_active: boolean
  can_order: boolean | null
  lock_reason?: string | null
}

/** Lý do KHÔNG đặt được với NCC này — `null` = đặt được. */
export function supplierOrderBlock(s: SupplierGate): string | null {
  if (!s.is_active) return 'NCC đã ngừng giao dịch'
  if (s.can_order === false) {
    const why = s.lock_reason?.trim()
    return `NCC đang bị khoá đặt hàng${why ? ` — ${why}` : ''}. Mở khoá ở hồ sơ NCC hoặc chọn NCC khác.`
  }
  return null
}

/**
 * Lý do KHÔNG huỷ được CẢ đơn — `null` = huỷ được. `qtyReceived` = tổng SL
 * đã về kho của mọi dòng (net phiếu đảo).
 */
export function cancelBlock(status: string, qtyReceived: number): string | null {
  if (status === 'received' || status === 'cancelled')
    return 'Đơn đã về đủ / đã huỷ — không huỷ được'
  // Nháp chưa qua bàn duyệt, chưa gửi ai → XOÁ hẳn (`remove`), không để lại một
  // đơn 'cancelled' rác. Trước 27/09/2026 chỉ giao diện chặn, server vẫn nhận.
  if (status === 'draft') return 'Đơn nháp — dùng "Xoá đơn" thay vì huỷ'
  if (qtyReceived > 1e-6) {
    return 'Đơn đã có hàng về kho — không huỷ cả đơn được. Chốt thiếu phần còn lại ở từng dòng (mục Giao & nhận) để đóng đơn mà vẫn giữ phần đã nhận.'
  }
  return null
}

/**
 * ĐẶT ÍT HƠN NHU CẦU — số còn thiếu so với nhu cầu của lệnh (đơn vị đặt).
 * `null` = không có nhu cầu để so, hoặc đã đủ. Màn cũ tô hổ phách ô này; màn
 * soạn mới làm rơi mất.
 */
export function underDemand(
  qtyOrdered: number | null | undefined,
  qtyDemand: number | null | undefined,
): number | null {
  if (qtyDemand == null || !(qtyDemand > 0)) return null
  const gap = qtyDemand - (qtyOrdered ?? 0)
  return gap > 1e-6 ? Math.round(gap * 1000) / 1000 : null
}
