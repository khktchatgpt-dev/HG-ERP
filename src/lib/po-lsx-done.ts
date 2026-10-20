/**
 * ĐƠN CÒN MỞ CỦA LỆNH ĐÃ HOÀN THÀNH (28/09/2026).
 *
 * Đo thật: 5 lệnh 01–05/26-27 MX đã hoàn thành (25/09) mà 13 đơn gia công của
 * chúng vẫn nằm "chờ duyệt"/"nháp" — sản xuất xong tức hàng đã về, chỉ là
 * không ai cập nhật đơn. Không màn nào báo, nên chúng chiếm gần hết hộp ký và
 * làm lệch mọi con số "đang mở". Chủ dự án chốt: gắn cảnh báo trên đơn + một ô
 * việc dẫn tới đúng danh sách.
 *
 * Luật: đơn ĐANG MỞ (chưa về đủ, chưa huỷ) mà MỌI lệnh nó mua cho — lệnh chính
 * và lệnh gộp (0125) — đều `completed`. Đơn mua chung cho một lệnh xong + một
 * lệnh còn chạy thì CHƯA tính: phần của lệnh kia vẫn có thể đang chờ hàng.
 */
export const LSX_DONE_STATUS = 'completed'

export type PoLsxLinks = {
  status: string
  production_order_id: string | null
  /** Trạng thái lệnh chính (embed) — thiếu thì coi như chưa biết → không tính. */
  lsx_status?: string | null
  extra_lsx?: { status?: string | null }[]
}

export function isPoOfDoneLsx(p: PoLsxLinks): boolean {
  if (p.status === 'received' || p.status === 'cancelled') return false
  const st = [
    ...(p.production_order_id ? [p.lsx_status] : []),
    ...(p.extra_lsx ?? []).map((x) => x.status),
  ]
  return st.length > 0 && st.every((s) => s === LSX_DONE_STATUS)
}
